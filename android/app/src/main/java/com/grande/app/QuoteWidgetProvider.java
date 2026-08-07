package com.grande.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.util.Log;
import android.util.TypedValue;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

public class QuoteWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager,
                                           int appWidgetId, Bundle newOptions) {
        // 위젯 크기가 바뀌면(리사이즈) 그 너비에 맞춰 텍스트 비트맵을 다시 그린다
        updateWidget(context, appWidgetManager, appWidgetId);
    }

    public static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        try {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.quote_widget);

            // 위젯의 현재 너비(dp)를 읽어 px로 변환. 값이 없으면 기본 폭 사용.
            Bundle options = manager.getAppWidgetOptions(widgetId);
            int widthDp = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            float density = context.getResources().getDisplayMetrics().density;
            int contentWidthPx = Math.round((widthDp - 32) * density);

            Typeface serif = loadFont(context, "fonts/noto_serif_kr.ttf");
            Typeface sansRegular = loadFont(context, "fonts/pretendard_regular.ttf");
            Typeface sansSemiBold = loadFont(context, "fonts/pretendard_semibold.ttf");

            String[] quote = getTodayQuote(context);
            String bodyText = quote != null ? quote[0] : "오늘의 글을 불러올 수 없습니다";
            String authorText = quote != null ? quote[1] : "";
            Log.d(TAG, "widget update: widthDp=" + widthDp + " bodyLen=" + bodyText.length() + " author=" + authorText);

            Bitmap bodyBmp = renderTextBitmap(context, bodyText, contentWidthPx, 18, "#2C2A28", serif, 1.35f);
            views.setImageViewBitmap(R.id.widget_text, bodyBmp);

            Bitmap authorBmp = renderTextBitmap(context, authorText, contentWidthPx, 13, "#A98053", sansRegular, 1.2f);
            views.setImageViewBitmap(R.id.widget_author, authorBmp);

            Bitmap brandBmp = renderBrandBitmap(context, sansSemiBold);
            views.setImageViewBitmap(R.id.widget_brand, brandBmp);

            // 위젯을 누르면 앱이 열리도록 연결
            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context, 0, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            manager.updateAppWidget(widgetId, views);
            Log.d(TAG, "widget update 성공");
        } catch (Throwable t) {
            Log.e(TAG, "widget update 실패", t);
        }
    }

    private static final String TAG = "GrandeWidget";

    // 폰트 로드 실패 시(파일 경로 문제 등) 기본 폰트로 대체해서, 전체 업데이트가 죽지 않게 한다
    private static Typeface loadFont(Context context, String assetPath) {
        try {
            return Typeface.createFromAsset(context.getAssets(), assetPath);
        } catch (Throwable t) {
            Log.e(TAG, "폰트 로드 실패: " + assetPath, t);
            return Typeface.DEFAULT;
        }
    }

    // 지정한 폰트로 텍스트를 줄바꿈까지 반영해 비트맵으로 그린다 (RemoteViews는 커스텀 폰트를 지원하지 않으므로
    // 우리 앱 프로세스 안에서 미리 이미지로 렌더링해서 넘긴다)
    private static Bitmap renderTextBitmap(Context context, String text, int widthPx,
                                            float textSizeSp, String colorHex, Typeface typeface,
                                            float lineSpacingMultiplier) {
        if (widthPx <= 0) widthPx = 600;
        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(typeface);
        paint.setColor(Color.parseColor(colorHex));
        paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, textSizeSp,
                context.getResources().getDisplayMetrics()));

        StaticLayout layout = StaticLayout.Builder
                .obtain(text, 0, text.length(), paint, widthPx)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, lineSpacingMultiplier)
                .setIncludePad(false)
                .build();

        Bitmap bmp = Bitmap.createBitmap(widthPx, Math.max(layout.getHeight(), 1), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        layout.draw(canvas);
        return bmp;
    }

    // 코너의 로고+"Grande" 워드마크를 한 장의 비트맵으로 합성
    private static Bitmap renderBrandBitmap(Context context, Typeface semiBold) {
        float density = context.getResources().getDisplayMetrics().density;
        int logoSize = Math.round(20 * density);
        int gap = Math.round(5 * density);

        Bitmap logo;
        try {
            int resId = context.getResources().getIdentifier("grande_ring_logo", "drawable", context.getPackageName());
            Bitmap raw = BitmapFactory.decodeResource(context.getResources(), resId);
            logo = Bitmap.createScaledBitmap(raw, logoSize, logoSize, true);
        } catch (Exception e) {
            Log.e(TAG, "로고 이미지 로드 실패", e);
            logo = Bitmap.createBitmap(logoSize, logoSize, Bitmap.Config.ARGB_8888);
        }

        TextPaint paint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        paint.setTypeface(semiBold);
        paint.setColor(Color.parseColor("#A98053"));
        paint.setAlpha((int) (0.9f * 255));
        paint.setTextSize(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 14f,
                context.getResources().getDisplayMetrics()));

        String label = "Grande";
        float textWidth = paint.measureText(label);
        Paint.FontMetrics fm = paint.getFontMetrics();
        int textHeight = Math.round(fm.descent - fm.ascent);

        int totalWidth = logoSize + gap + Math.round(textWidth);
        int totalHeight = Math.max(logoSize, textHeight);

        Bitmap bmp = Bitmap.createBitmap(totalWidth, totalHeight, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);

        Paint logoPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        logoPaint.setAlpha((int) (0.9f * 255));
        canvas.drawBitmap(logo, 0, (totalHeight - logoSize) / 2f, logoPaint);

        float textBaseline = (totalHeight - (fm.descent - fm.ascent)) / 2f - fm.ascent;
        canvas.drawText(label, logoSize + gap, textBaseline, paint);

        return bmp;
    }

    // ── 오늘의 글 선정 ───────────────────────────────────────────────────────
    // 앱이 쓰는 public/quotes.js를 그대로 읽어 "오늘의 글"을 고른다.
    //
    // 이 아래 세 함수는 www/index.html의 simpleHash / buildDailyOrder /
    // daysSinceEpoch와 **반드시 같은 결과를 내야 한다**. 하나라도 어긋나면
    // 위젯과 앱이 같은 날 서로 다른 글을 보여준다.
    // index.html의 선정 로직을 고칠 때는 여기도 같이 고칠 것.
    private static long simpleHash(String str) {
        long hash = 0;
        for (int i = 0; i < str.length(); i++) {
            hash = (hash * 31 + str.charAt(i)) % 1000000007L;
        }
        return hash;
    }

    private static final class OrderItem {
        final String id; final double key; final long tb;
        OrderItem(String id, double key, long tb) { this.id = id; this.key = key; this.tb = tb; }
    }

    // 저자별로 묶은 뒤 저자마다 다른 위상(phase)을 주어 고르게 흩뿌린다.
    // 같은 저자의 글이 연달아 나오지 않게 하려는 것으로, 배열 저장 순서와는 무관하다.
    private static List<String> buildDailyOrder(JSONArray arr) throws Exception {
        Map<String, List<String>> groups = new LinkedHashMap<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.getJSONObject(i);
            String author = o.optString("author", "");
            List<String> ids = groups.get(author);
            if (ids == null) { ids = new ArrayList<>(); groups.put(author, ids); }
            ids.add(o.getString("id"));
        }

        List<OrderItem> items = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : groups.entrySet()) {
            List<String> ids = new ArrayList<>(e.getValue());
            Collections.sort(ids, (x, y) -> Long.compare(simpleHash(x), simpleHash(y)));
            int c = ids.size();
            double phase = (double) simpleHash(e.getKey()) / 1000000007.0;
            for (int i = 0; i < c; i++) {
                items.add(new OrderItem(ids.get(i), (i + phase) / c, simpleHash(ids.get(i))));
            }
        }
        Collections.sort(items, (x, y) -> {
            int c = Double.compare(x.key, y.key);
            return c != 0 ? c : Long.compare(x.tb, y.tb);
        });

        List<String> order = new ArrayList<>(items.size());
        for (OrderItem it : items) order.add(it.id);
        return order;
    }

    // 날짜 부분만 UTC로 정규화해 얻은 일수. 서머타임·시간대와 무관하게
    // 하루에 정확히 한 칸씩 움직인다.
    private static long daysSinceEpoch(Calendar local) {
        Calendar utc = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        utc.clear();
        utc.set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH));
        return Math.floorDiv(utc.getTimeInMillis(), 86400000L);
    }

    private static String[] getTodayQuote(Context context) {
        try {
            InputStream is = context.getAssets().open("public/quotes.js");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line).append("\n");
            reader.close();

            String raw = sb.toString();
            int eq = raw.indexOf("= ");
            String jsonStr = raw.substring(eq + 2).trim();
            if (jsonStr.endsWith(";")) jsonStr = jsonStr.substring(0, jsonStr.length() - 1);

            JSONArray arr = new JSONArray(jsonStr);
            int n = arr.length();
            if (n == 0) return null;

            List<String> order = buildDailyOrder(arr);

            // 예전에는 YYYYMMDD를 그대로 나머지 연산해서 월 경계마다 인덱스가
            // 70칸씩(연 경계엔 8870칸) 건너뛰었다. 일수 차이를 쓰면 한 주기 동안
            // 중복도 누락도 없이 정확히 한 바퀴 돈다.
            long days = daysSinceEpoch(Calendar.getInstance());
            int pos = (int) (((days % n) + n) % n);
            String pickedId = order.get(pos);

            for (int i = 0; i < n; i++) {
                JSONObject obj = arr.getJSONObject(i);
                if (pickedId.equals(obj.getString("id"))) {
                    return new String[]{obj.getString("text"), obj.optString("author", "")};
                }
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }
}
