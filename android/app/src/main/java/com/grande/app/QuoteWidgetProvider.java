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
import java.util.Calendar;

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

    // 앱이 쓰는 quotes.js를 그대로 읽어, 앱과 동일한 규칙(ID 해시 기반 셔플)으로
    // "오늘의 글" 인덱스를 계산한다. 배열 저장 순서와 무관해야 앱과 항상 같은 결과가 나온다.
    private static long simpleHash(String str) {
        long hash = 0;
        for (int i = 0; i < str.length(); i++) {
            hash = (hash * 31 + str.charAt(i)) % 1000000007L;
        }
        return hash;
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

            // id 해시로 정렬한 고정 순서(셔플)를 만든다 — 배열 원래 저장 순서와 무관
            Integer[] order = new Integer[n];
            final long[] hashes = new long[n];
            for (int i = 0; i < n; i++) {
                order[i] = i;
                hashes[i] = simpleHash(arr.getJSONObject(i).getString("id"));
            }
            java.util.Arrays.sort(order, (a, b) -> Long.compare(hashes[a], hashes[b]));

            Calendar cal = Calendar.getInstance();
            int year = cal.get(Calendar.YEAR);
            int month = cal.get(Calendar.MONTH) + 1;
            int day = cal.get(Calendar.DAY_OF_MONTH);
            int seed = year * 10000 + month * 100 + day;
            int posInShuffled = ((seed % n) + n) % n;
            int idx = order[posInShuffled];

            JSONObject obj = arr.getJSONObject(idx);
            String fullText = obj.getString("text");
            String author = obj.optString("author", "");
            return new String[]{fullText, author};
        } catch (Exception e) {
            return null;
        }
    }
}
