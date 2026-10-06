package cool.devfridge.world;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;

/** Local ACTION_SEND receiver; Java keeps this standalone test-APK activity independent of app Kotlin classes. */
public final class ShareReceiptActivity extends Activity {
    private Bitmap preview;
    private LinearLayout content;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(23, 35, 28));
        root.setPadding(20, 28, 20, 28);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(20 + bars.left, 28 + bars.top, 20 + bars.right, 28 + bars.bottom);
            } else {
                view.setPadding(20 + insets.getSystemWindowInsetLeft(), 28 + insets.getSystemWindowInsetTop(),
                    20 + insets.getSystemWindowInsetRight(), 28 + insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(content);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1f));
        text("LOCAL SHARE RECEIPT · test target", 19f).setContentDescription("Local share receipt test target");
        text("Received through Android sharing. Saved only in the test APK on this emulator. No message was sent externally.", 13f);
        JSONObject receipt = new JSONObject();
        put(receipt, "receivedAtUtc", Instant.now().toString());
        put(receipt, "testTarget", true);
        put(receipt, "sentExternally", false);
        put(receipt, "action", getIntent().getAction());
        put(receipt, "mimeType", getIntent().getType());
        try {
            Intent source = getIntent();
            require(Intent.ACTION_SEND.equals(source.getAction()), "Expected a real ACTION_SEND intent.");
            String caption = source.getStringExtra(Intent.EXTRA_TEXT);
            if (caption == null) caption = "";
            if (caption.length() > 4000) caption = caption.substring(0, 4000);
            receipt.put("caption", caption);
            File directory = getExternalFilesDir(null);
            require(directory != null, "Test output directory unavailable.");
            if ("image/png".equals(source.getType())) {
                Uri uri = streamUri(source);
                require(uri != null, "The share intent did not include its PNG stream.");
                require("content".equals(uri.getScheme()) && "cool.devfridge.world.files".equals(uri.getAuthority()),
                    "Only the app's granted score FileProvider stream is accepted.");
                // Opening this cross-package stream verifies the actual temporary read permission.
                byte[] bytes = readBounded(uri);
                byte[] signature = new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10};
                require(bytes.length >= signature.length, "Received payload is not a PNG.");
                for (int i = 0; i < signature.length; i++) require(bytes[i] == signature[i], "Received payload is not a PNG.");
                BitmapFactory.Options dimensions = new BitmapFactory.Options();
                dimensions.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, dimensions);
                require(dimensions.outWidth >= 1 && dimensions.outWidth <= 8192 && dimensions.outHeight >= 1 && dimensions.outHeight <= 8192
                    && (long) dimensions.outWidth * dimensions.outHeight <= 16_777_216L, "PNG dimensions are invalid or excessive.");
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 1;
                while (dimensions.outWidth / options.inSampleSize > 1600 || dimensions.outHeight / options.inSampleSize > 1600) options.inSampleSize *= 2;
                preview = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                require(preview != null, "The actual PNG could not be decoded.");
                byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
                StringBuilder hash = new StringBuilder(64);
                for (byte value : digest) hash.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
                write(new File(directory, "share-receipt.png"), bytes);
                receipt.put("streamUri", uri.toString()).put("readPermissionGranted", true)
                    .put("explicitGrantFlag", (source.getFlags() & Intent.FLAG_GRANT_READ_URI_PERMISSION) != 0)
                    .put("pngBytes", bytes.length).put("pngWidth", dimensions.outWidth).put("pngHeight", dimensions.outHeight)
                    .put("pngSha256", hash.toString()).put("outputPng", "share-receipt.png");
                text("PNG received · " + dimensions.outWidth + " × " + dimensions.outHeight + "\n" + bytes.length + " bytes · read permission verified", 13f);
                ImageView image = new ImageView(this);
                image.setAdjustViewBounds(true);
                image.setScaleType(ImageView.ScaleType.FIT_CENTER);
                image.setImageBitmap(preview);
                image.setContentDescription("Actual score image received from DevFridge World");
                content.addView(image, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                text("SHA-256\n" + hash, 11f);
            } else if ("text/plain".equals(source.getType())) {
                receipt.put("outputPng", JSONObject.NULL);
            } else {
                throw new IllegalArgumentException("Only public text or a PNG score image is supported.");
            }
            text("Received caption\n" + caption, 14f);
            receipt.put("accepted", true);
            write(new File(directory, "share-receipt.json"), receipt.toString(2).getBytes(StandardCharsets.UTF_8));
            text("Receipt saved locally: share-receipt.json", 12f);
        } catch (Exception error) {
            put(receipt, "accepted", false);
            put(receipt, "error", error.getMessage());
            try {
                File directory = getExternalFilesDir(null);
                if (directory != null) write(new File(directory, "share-receipt.json"), receipt.toString(2).getBytes(StandardCharsets.UTF_8));
            } catch (Exception outputError) {
                text("Local receipt could not be saved.", 13f);
            }
            text("Share receipt failed\n" + error.getMessage(), 15f);
        }
        Button back = new Button(this);
        back.setText("Return to game");
        back.setContentDescription("Return from local share test");
        back.setOnClickListener(view -> finish());
        root.addView(back);
        setContentView(root);
    }

    private TextView text(String value, float size) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(Color.WHITE);
        view.setPadding(0, 8, 0, 8);
        view.setTextIsSelectable(true);
        content.addView(view);
        return view;
    }

    private byte[] readBounded(Uri uri) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (InputStream stream = getContentResolver().openInputStream(uri)) {
            require(stream != null, "The FileProvider did not grant readable image content.");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) >= 0) {
                require(output.size() + count <= 4_000_000, "The shared PNG exceeds 4 MB.");
                output.write(buffer, 0, count);
            }
        }
        return output.toByteArray();
    }

    @SuppressWarnings("deprecation") private Uri streamUri(Intent source) {
        if (Build.VERSION.SDK_INT >= 33) return source.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        return source.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    private static void require(boolean condition, String message) {
        if (!condition) throw new IllegalArgumentException(message);
    }

    private static void put(JSONObject object, String name, Object value) {
        try { object.put(name, value); }
        catch (org.json.JSONException error) { throw new IllegalStateException(error); }
    }

    private static void write(File file, byte[] bytes) throws Exception {
        try (FileOutputStream stream = new FileOutputStream(file)) { stream.write(bytes); }
    }

    @Override public void onDestroy() {
        if (preview != null) preview.recycle();
        preview = null;
        super.onDestroy();
    }
}
