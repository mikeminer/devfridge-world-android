"""Read-only checks of the exact published APK; writes receipts, never installs it."""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def tree(dump):
    roots, stack = [], []
    for line in dump.splitlines():
        element = re.match(r"^(\s*)E: ([^ ]+)", line)
        if element:
            depth = len(element[1])
            while stack and stack[-1][0] >= depth:
                stack.pop()
            node = {"name": element[2], "attrs": {}, "children": []}
            (stack[-1][1]["children"] if stack else roots).append(node)
            stack.append((depth, node))
        elif stack:
            attribute = re.match(r"^\s*A: (?:http://schemas.android.com/apk/res/android:)?([^=(]+)(?:\([^)]*\))?=(.*)$", line)
            if attribute:
                value = attribute[2]
                if value.startswith('"'):
                    value = json.JSONDecoder().raw_decode(value)[0]
                elif value in ("true", "false"):
                    value = value == "true"
                stack[-1][1]["attrs"][attribute[1]] = value
    return roots


def children(node, name):
    return [child for child in node["children"] if child["name"] == name]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--aapt2", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    options = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    release = json.loads((repo / "evidence/2026-10-06/beta2-release.json").read_text(encoding="utf-8"))
    apk_hash = sha256(options.apk.read_bytes())
    if apk_hash != release["sha256"]:
        raise ValueError("APK differs from the published beta.2 receipt; this check will not relabel another artifact")
    options.out.mkdir(parents=True, exist_ok=True)

    def aapt(*arguments):
        return subprocess.run([str(options.aapt2), *arguments], check=True, capture_output=True, text=True, encoding="utf-8").stdout

    resource_dump = aapt("dump", "resources", str(options.apk))
    resources = {}
    for name in ("file_paths", "network_security_config", "data_extraction_rules"):
        match = re.search(r"resource (0x[0-9a-f]+) xml/" + name + r"\s+\(\) \(file\) (\S+) type=XML", resource_dump)
        if not match:
            raise ValueError("Missing compiled resource " + name)
        resources[name] = {"id": match[1], "file": match[2]}
    dumps = {"manifest": aapt("dump", "xmltree", str(options.apk), "--file", "AndroidManifest.xml")}
    for name, resource in resources.items():
        dumps[name] = aapt("dump", "xmltree", str(options.apk), "--file", resource["file"])
    for name, dump in dumps.items():
        (options.out / ("signed-beta2-" + name + ".txt")).write_text(dump, encoding="utf-8", newline="\n")

    manifest = tree(dumps["manifest"])[0]
    application = children(manifest, "application")[0]
    activities = children(application, "activity")
    providers = children(application, "provider")
    receivers = children(application, "receiver")
    checks = {}

    def check(name, value):
        checks[name] = bool(value)
        if not value:
            raise AssertionError(name)

    check("expected_package_version", manifest["attrs"].get("package") == release["packageName"] and manifest["attrs"].get("versionCode") == "9" and manifest["attrs"].get("versionName") == release["versionName"])
    check("one_exported_launcher_activity", len(activities) == 1 and activities[0]["attrs"].get("name") == "cool.devfridge.world.MainActivity" and activities[0]["attrs"].get("exported") is True)
    check("test_receipt_and_invoker_activities_absent", "ShareReceiptActivity" not in dumps["manifest"] and "InstrumentationActivityInvoker" not in dumps["manifest"])
    provider_map = {item["attrs"].get("name"): item["attrs"] for item in providers}
    check("providers_non_exported", len(providers) == 2 and all(item["attrs"].get("exported") is False for item in providers))
    check("share_provider_authority_and_scoped_permission", provider_map["androidx.core.content.FileProvider"].get("authorities") == "cool.devfridge.world.files" and provider_map["androidx.core.content.FileProvider"].get("grantUriPermissions") is True)
    check("exported_receiver_has_dump_permission", len(receivers) == 1 and receivers[0]["attrs"].get("name") == "androidx.profileinstaller.ProfileInstallReceiver" and receivers[0]["attrs"].get("exported") is True and receivers[0]["attrs"].get("permission") == "android.permission.DUMP")
    check("backup_disabled", application["attrs"].get("allowBackup") is False)
    check("application_cleartext_disabled", application["attrs"].get("usesCleartextTraffic") is False)
    check("manifest_references_inspected_share_paths", children([item for item in providers if item["attrs"].get("name") == "androidx.core.content.FileProvider"][0], "meta-data")[0]["attrs"].get("resource") == "@" + resources["file_paths"]["id"])
    check("manifest_references_inspected_network_policy", application["attrs"].get("networkSecurityConfig") == "@" + resources["network_security_config"]["id"])
    path_nodes = tree(dumps["file_paths"])[0]["children"]
    check("only_share_cache_is_exposed", len(path_nodes) == 1 and path_nodes[0]["name"] == "cache-path" and path_nodes[0]["attrs"] == {"name": "shares", "path": "shares/"})
    network = tree(dumps["network_security_config"])[0]
    check("network_default_cleartext_disabled", children(network, "base-config")[0]["attrs"].get("cleartextTrafficPermitted") is False)
    domain_groups = children(network, "domain-config")
    domain_dump = dumps["network_security_config"]
    check("only_loopback_cleartext_exception", len(domain_groups) == 1 and domain_groups[0]["attrs"].get("cleartextTrafficPermitted") is True and len(children(domain_groups[0], "domain")) == 2 and 'localhost' in domain_dump and '127.0.0.1' in domain_dump and all(item["attrs"].get("includeSubdomains") is False for item in children(domain_groups[0], "domain")))
    check("no_custom_release_trust_anchors", "trust-anchors" not in domain_dump and "debug-overrides" not in domain_dump)

    assets = {}
    targets = ("native-bridge.js", "registration-handoff.js", "adaptive-coach.js", "assets/gate-2.js", "assets/cold-storage.js", "cast.json", "practice/practice-game.js", "practice/index.html")
    with ZipFile(options.apk) as archive:
        check("compiled_classes_unchanged", sha256(archive.read("classes.dex")) == "85f1d0aaad391cb9c0131cf15a8ff8620d9f4207d131197ab3326c2757907a92")
        for path in targets:
            data = archive.read("assets/game/" + path)
            local = repo / "android/app/src/main/assets/game" / path
            check("asset_matches_signed_apk:" + path, local.read_bytes() == data)
            assets[path] = {"bytes": len(data), "sha256": sha256(data)}
    source_path = "android/app/src/main/java/cool/devfridge/world/BridgePolicy.kt"
    source = subprocess.run(["git", "show", release["sourceCommit"] + ":" + source_path], cwd=repo, check=True, capture_output=True).stdout.replace(b"\r\n", b"\n")
    check("jvm_policy_source_matches_release_tag", (repo / source_path).read_bytes().replace(b"\r\n", b"\n") == source)
    receipt = {"recordedAtUtc": datetime.now(timezone.utc).isoformat(), "apkSha256": apk_hash, "apkBytes": options.apk.stat().st_size, "sourceCommit": release["sourceCommit"], "checks": checks, "assets": assets, "compiledResources": resources, "bridgePolicyNormalizedSha256": sha256(source), "scope": "Static inspection of exact signed APK and byte equality for subsequently tested adapters. No APK execution, TLS handshake, wallet flow, independent audit or complete engine security claim."}
    (options.out / "signed-beta2-boundaries.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"checksPassed": len(checks), "apkSha256": apk_hash, "output": "signed-beta2-boundaries.json"}))


if __name__ == "__main__":
    main()
