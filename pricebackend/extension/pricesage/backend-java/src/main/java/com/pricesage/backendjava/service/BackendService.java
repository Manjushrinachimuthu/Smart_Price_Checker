package com.pricesage.backendjava.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class BackendService {
  private static final String STORE_HISTORY_FILE = "store-price-history.json";
  private static final String ALERTS_FILE = "alerts.json";
  private static final String SETTINGS_FILE = "notification-settings.json";
  private static final String CAPTURES_FILE = "extension-captures.json";
  private static final int MAX_ALERTS = 300;

  private final JsonFileService fileService;
  private final CompareService compareService;

  public BackendService(JsonFileService fileService, CompareService compareService) {
    this.fileService = fileService;
    this.compareService = compareService;
  }

  public Map<String, Object> getSettings() {
    Map<String, Object> defaults = new LinkedHashMap<>();
    defaults.put("inAppEnabled", true);
    defaults.put("browserEnabled", true);
    defaults.put("telegramEnabled", false);
    defaults.put("telegramChatId", "");
    defaults.put("dropPercentThreshold", 3);
    defaults.put("cooldownHours", 6);
    defaults.put("quietHoursStart", "22:00");
    defaults.put("quietHoursEnd", "08:00");

    Map<String, Object> saved = fileService.readObject(SETTINGS_FILE);
    defaults.putAll(saved);
    return defaults;
  }

  public Map<String, Object> saveSettings(Map<String, Object> incoming) {
    Map<String, Object> merged = getSettings();
    if (incoming != null) merged.putAll(incoming);
    fileService.writeObject(SETTINGS_FILE, merged);
    return merged;
  }

  public Map<String, Object> saveCapture(Map<String, Object> incoming) {
    String url = str(incoming.get("url"));
    if (url.isBlank()) throw new IllegalArgumentException("url is required");
    try {
      java.net.URI.create(url).toURL();
    } catch (Exception e) {
      throw new IllegalArgumentException("Please provide a valid product URL");
    }

    Map<String, Object> capture = new LinkedHashMap<>();
    capture.put("id", "cap_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 6));
    capture.put("createdAt", PriceUtils.nowIso());
    capture.put("url", url);
    capture.put("title", nullableTrim(incoming.get("title")));
    capture.put("priceText", nullableTrim(incoming.get("priceText")));
    capture.put("image", nullableTrim(incoming.get("image")));
    capture.put("details", nullableTrim(incoming.get("details")));
    capture.put("sourceStore", PriceUtils.detectStoreFromUrl(url));

    List<Map<String, Object>> captures = fileService.readArray(CAPTURES_FILE);
    captures.add(capture);
    fileService.writeArray(CAPTURES_FILE, captures);
    return Map.of("success", true, "capture", capture);
  }

  public Map<String, Object> getCaptures(int limit) {
    int bounded = Math.max(1, Math.min(100, limit));
    List<Map<String, Object>> captures = new ArrayList<>(fileService.readArray(CAPTURES_FILE));
    captures.sort((a, b) -> str(b.get("createdAt")).compareTo(str(a.get("createdAt"))));
    if (captures.size() > bounded) captures = captures.subList(0, bounded);
    return Map.of("captures", captures);
  }

  @SuppressWarnings("unchecked")
  public Map<String, Object> trackStore(Map<String, Object> body) {
    String product = str(body.get("product")).trim();
    String store = str(body.get("store")).trim();
    Double priceNum = toDouble(body.get("price"));
    if (product.isBlank() || store.isBlank() || priceNum == null || priceNum <= 0) {
      throw new IllegalArgumentException("product, store and valid price are required");
    }
    int price = (int) Math.round(priceNum);

    String trackKey = normalizeTrackKey(body.get("trackKey"), product, store);
    String storeKey = store.toLowerCase(Locale.ROOT).trim();
    Map<String, Object> root = fileService.readObject(STORE_HISTORY_FILE);
    Map<String, Object> bucket = asMap(root.getOrDefault(trackKey, new LinkedHashMap<>()));
    Map<String, Object> node = asMap(bucket.getOrDefault(storeKey, new LinkedHashMap<>()));

    Integer previousPrice = null;
    Integer previousMin = null;
    List<Map<String, Object>> history = asListOfMap(node.getOrDefault("history", new ArrayList<>()));
    if (!history.isEmpty()) {
      previousPrice = toInt(history.get(history.size() - 1).get("price"));
      previousMin = history.stream().map(h -> toInt(h.get("price"))).filter(Objects::nonNull).min(Integer::compareTo).orElse(null);
    }

    Map<String, Object> latest = new LinkedHashMap<>();
    latest.put("day", PriceUtils.todayUtc());
    latest.put("price", price);
    latest.put("fetchedAt", PriceUtils.nowIso());
    latest.put("link", nullableTrim(body.get("link")));
    if (!history.isEmpty() && Objects.equals(str(history.get(history.size() - 1).get("day")), PriceUtils.todayUtc())) {
      history.set(history.size() - 1, latest);
    } else {
      history.add(latest);
    }

    node.put("product", product);
    node.put("store", store);
    node.put("trackKey", trackKey);
    node.put("history", history);
    node.put("paused", node.getOrDefault("paused", false));
    node.put("image", nullableTrim(body.get("image")));
    node.put("productTitle", Optional.ofNullable(nullableTrim(body.get("productTitle"))).orElse(product));
    node.put("details", nullableTrim(body.get("details")));

    Integer targetPrice = toInt(body.get("targetPrice"));
    if (targetPrice != null && targetPrice > 0) {
      node.put("targetPrice", targetPrice);
    } else if (!node.containsKey("targetPrice")) {
      node.put("targetPrice", 0);
    }

    bucket.put(storeKey, node);
    root.put(trackKey, bucket);
    fileService.writeObject(STORE_HISTORY_FILE, root);

    maybeCreateTrackingAlerts(product, store, trackKey, price, previousPrice, previousMin, toInt(node.get("targetPrice")), nullableTrim(body.get("link")));

    Map<String, Object> response = new LinkedHashMap<>();
    response.put("product", product);
    response.put("store", store);
    response.put("trackKey", trackKey);
    response.put("targetPrice", node.get("targetPrice"));
    response.put("history", history);
    response.put("paused", Boolean.TRUE.equals(node.get("paused")));
    return response;
  }

  public Map<String, Object> toggleTracking(Map<String, Object> body) {
    String product = str(body.get("product")).trim();
    String store = str(body.get("store")).trim();
    if (product.isBlank() || store.isBlank()) {
      throw new IllegalArgumentException("product and store are required");
    }
    String trackKey = normalizeTrackKey(body.get("trackKey"), product, store);
    boolean enabled = Boolean.TRUE.equals(body.get("enabled"));

    Map<String, Object> root = fileService.readObject(STORE_HISTORY_FILE);
    Map<String, Object> bucket = asMap(root.get(trackKey));
    if (bucket.isEmpty()) throw new IllegalArgumentException("Tracked store not found");
    String storeKey = store.toLowerCase(Locale.ROOT).trim();
    Map<String, Object> node = asMap(bucket.get(storeKey));
    if (node.isEmpty()) throw new IllegalArgumentException("Tracked store not found");
    node.put("paused", !enabled);
    bucket.put(storeKey, node);
    root.put(trackKey, bucket);
    fileService.writeObject(STORE_HISTORY_FILE, root);

    return Map.of(
      "product", product,
      "store", store,
      "trackKey", trackKey,
      "enabled", enabled,
      "paused", !enabled
    );
  }

  public Map<String, Object> getTrackHistory(String product, String store, Object trackKeyIn) {
    if (str(product).isBlank() || str(store).isBlank()) {
      throw new IllegalArgumentException("product and store are required");
    }
    String trackKey = normalizeTrackKey(trackKeyIn, product, store);
    Map<String, Object> node = getTrackedNode(trackKey, store);
    List<Map<String, Object>> history = asListOfMap(node.getOrDefault("history", new ArrayList<>()));
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("product", product);
    out.put("store", store);
    out.put("trackKey", trackKey);
    out.put("history", history);
    out.put("paused", Boolean.TRUE.equals(node.get("paused")));
    out.put("image", node.get("image"));
    out.put("productTitle", node.get("productTitle"));
    out.put("details", node.get("details"));
    return out;
  }

  public Map<String, Object> getPriceInsights(String product, String store, Object trackKeyIn) {
    Map<String, Object> historyPayload = getTrackHistory(product, store, trackKeyIn);
    List<Map<String, Object>> history = asListOfMap(historyPayload.get("history"));
    Map<String, Object> insights = analyzePriceSeries(history);
    return Map.of(
      "product", product,
      "store", store,
      "trackKey", historyPayload.get("trackKey"),
      "samples", history.size(),
      "insights", insights
    );
  }

  public Map<String, Object> getAlerts(Integer limitIn, String since) {
    int limit = Math.max(1, Math.min(200, limitIn == null ? 50 : limitIn));
    List<Map<String, Object>> alerts = new ArrayList<>(fileService.readArray(ALERTS_FILE));
    alerts.sort((a, b) -> str(b.get("createdAt")).compareTo(str(a.get("createdAt"))));
    if (since != null && !since.isBlank()) {
      alerts = alerts.stream()
        .filter(a -> str(a.get("createdAt")).compareTo(since) > 0)
        .toList();
    }
    if (alerts.size() > limit) alerts = alerts.subList(0, limit);
    long unread = alerts.stream().filter(a -> !Boolean.TRUE.equals(a.get("read"))).count();
    return Map.of("alerts", alerts, "unread", unread);
  }

  public Map<String, Object> markAlertsRead(String id) {
    List<Map<String, Object>> alerts = new ArrayList<>(fileService.readArray(ALERTS_FILE));
    for (Map<String, Object> alert : alerts) {
      if (id == null || id.isBlank() || id.equals(str(alert.get("id")))) {
        alert.put("read", true);
      }
    }
    fileService.writeArray(ALERTS_FILE, alerts);
    return Map.of("success", true);
  }

  private void maybeCreateTrackingAlerts(
    String product,
    String store,
    String trackKey,
    int currentPrice,
    Integer previousPrice,
    Integer previousMin,
    Integer targetPrice,
    String link
  ) {
    Map<String, Object> settings = getSettings();
    double dropThreshold = toDouble(settings.get("dropPercentThreshold")) == null ? 3 : toDouble(settings.get("dropPercentThreshold"));
    if (previousPrice != null && previousPrice > 0) {
      double drop = ((previousPrice - currentPrice) * 100.0) / previousPrice;
      if (drop >= dropThreshold) {
        createAlert("price_drop", "high", product, store, trackKey, currentPrice, link,
          "Price dropped " + String.format(Locale.ROOT, "%.1f", drop) + "%",
          store + ": " + previousPrice + " -> " + currentPrice);
      }
    }
    if (targetPrice != null && targetPrice > 0 && currentPrice <= targetPrice) {
      createAlert("target_hit", "critical", product, store, trackKey, currentPrice, link,
        "Target price hit",
        store + " reached your target at Rs " + currentPrice);
    }
    if (previousMin != null && currentPrice < previousMin) {
      createAlert("new_low", "high", product, store, trackKey, currentPrice, link,
        "New tracked low",
        store + " reached a new low: Rs " + currentPrice);
    }
  }

  private void createAlert(
    String type,
    String priority,
    String product,
    String store,
    String trackKey,
    Integer price,
    String link,
    String title,
    String message
  ) {
    List<Map<String, Object>> alerts = new ArrayList<>(fileService.readArray(ALERTS_FILE));
    Map<String, Object> alert = new LinkedHashMap<>();
    alert.put("id", type + "_" + trackKey.replaceAll("[^a-zA-Z0-9]+", "_") + "_" + price + "_" + System.currentTimeMillis());
    alert.put("createdAt", PriceUtils.nowIso());
    alert.put("read", false);
    alert.put("sentTelegram", false);
    alert.put("type", type);
    alert.put("priority", priority);
    alert.put("product", product);
    alert.put("store", store);
    alert.put("trackKey", trackKey);
    alert.put("price", price);
    alert.put("link", link);
    alert.put("title", title);
    alert.put("message", message);
    alerts.add(alert);
    alerts.sort(Comparator.comparing(a -> str(((Map<String, Object>) a).get("createdAt"))));
    if (alerts.size() > MAX_ALERTS) {
      alerts = new ArrayList<>(alerts.subList(alerts.size() - MAX_ALERTS, alerts.size()));
    }
    fileService.writeArray(ALERTS_FILE, alerts);
  }

  private Map<String, Object> analyzePriceSeries(List<Map<String, Object>> history) {
    List<Map<String, Object>> points = asListOfMap(history).stream()
      .filter(entry -> toInt(entry.get("price")) != null)
      .sorted(Comparator.comparing(entry -> str(entry.get("day"))))
      .toList();

    if (points.isEmpty()) {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("trend", "No data");
      out.put("recommendation", "Track this store for a few days to unlock insights.");
      out.put("volatility", 0);
      out.put("confidence", "Low");
      out.put("latestPrice", null);
      out.put("expectedMin7d", null);
      out.put("expectedMax7d", null);
      out.put("dayChange", null);
      out.put("weekChange", null);
      return out;
    }

    List<Integer> prices = points.stream().map(p -> toInt(p.get("price"))).filter(Objects::nonNull).toList();
    int latest = prices.get(prices.size() - 1);
    int prev = prices.size() >= 2 ? prices.get(prices.size() - 2) : latest;
    int dayChange = latest - prev;

    List<Integer> tail7 = prices.size() > 7 ? prices.subList(prices.size() - 7, prices.size()) : prices;
    int weekBase = tail7.size() >= 2 ? tail7.get(0) : latest;
    int weekChange = latest - weekBase;

    double mean = prices.stream().mapToInt(Integer::intValue).average().orElse(0);
    double variance = prices.stream().mapToDouble(v -> Math.pow(v - mean, 2)).average().orElse(0);
    double stdDev = Math.sqrt(variance);
    double volatility = mean > 0 ? (stdDev / mean) * 100 : 0;

    double slope = 0;
    if (prices.size() > 1) {
      int n = prices.size();
      double sumX = (n * (n - 1)) / 2.0;
      double sumY = prices.stream().mapToDouble(Integer::doubleValue).sum();
      double sumXY = 0;
      double sumX2 = 0;
      for (int i = 0; i < prices.size(); i++) {
        sumXY += i * prices.get(i);
        sumX2 += i * (double) i;
      }
      double denominator = n * sumX2 - sumX * sumX;
      slope = denominator == 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
    }

    String trend = "Stable";
    if (slope <= -8 || weekChange < 0) trend = "Falling";
    else if (slope >= 8 || weekChange > 0) trend = "Rising";

    int low7 = tail7.stream().min(Integer::compareTo).orElse(latest);
    int high7 = tail7.stream().max(Integer::compareTo).orElse(latest);
    int buffer = (int) Math.round(stdDev * 0.6);
    int expectedMin7d = Math.max(1, low7 - buffer);
    int expectedMax7d = high7 + buffer;

    String recommendation = "Price is stable. Buy if needed.";
    if ("Falling".equals(trend)) recommendation = "Price trend is down. Waiting may give a better deal.";
    if ("Rising".equals(trend)) recommendation = "Price trend is up. Buying sooner could be better.";
    if (volatility >= 10) recommendation += " High volatility detected.";

    String confidence = points.size() >= 14 ? "High" : points.size() >= 7 ? "Medium" : "Low";

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("trend", trend);
    out.put("recommendation", recommendation);
    out.put("volatility", Math.round(volatility * 100.0) / 100.0);
    out.put("confidence", confidence);
    out.put("latestPrice", latest);
    out.put("expectedMin7d", expectedMin7d);
    out.put("expectedMax7d", expectedMax7d);
    out.put("dayChange", dayChange);
    out.put("weekChange", weekChange);
    return out;
  }

  @Scheduled(fixedDelayString = "${pricesage.tracking-refresh-ms:1200000}")
  public void refreshTrackedPrices() {
    Map<String, Object> root = fileService.readObject(STORE_HISTORY_FILE);
    if (root.isEmpty()) return;
    boolean dirty = false;

    for (Map.Entry<String, Object> entry : root.entrySet()) {
      String trackKey = entry.getKey();
      Map<String, Object> bucket = asMap(entry.getValue());
      for (Map.Entry<String, Object> storeEntry : bucket.entrySet()) {
        Map<String, Object> node = asMap(storeEntry.getValue());
        if (Boolean.TRUE.equals(node.get("paused"))) continue;
        List<Map<String, Object>> history = asListOfMap(node.get("history"));
        if (history.isEmpty()) continue;
        String link = str(history.get(history.size() - 1).get("link"));
        if (link.isBlank()) continue;

        try {
          Map<String, Object> compared = compareService.compare(link);
          Integer price = toInt(compared.get("sourcePrice"));
          if (price == null || price <= 0) continue;
          Integer previous = toInt(history.get(history.size() - 1).get("price"));

          Map<String, Object> next = new LinkedHashMap<>();
          next.put("day", PriceUtils.todayUtc());
          next.put("price", price);
          next.put("fetchedAt", PriceUtils.nowIso());
          next.put("link", link);
          if (!history.isEmpty() && Objects.equals(str(history.get(history.size() - 1).get("day")), PriceUtils.todayUtc())) {
            history.set(history.size() - 1, next);
          } else {
            history.add(next);
          }
          node.put("history", history);
          bucket.put(storeEntry.getKey(), node);
          root.put(trackKey, bucket);
          dirty = true;

          maybeCreateTrackingAlerts(
            str(node.get("product")),
            str(node.get("store")),
            str(node.get("trackKey")),
            price,
            previous,
            history.stream().map(h -> toInt(h.get("price"))).filter(Objects::nonNull).min(Integer::compareTo).orElse(null),
            toInt(node.get("targetPrice")),
            link
          );
        } catch (Exception ignored) {
          // Keep scheduler resilient.
        }
      }
    }

    if (dirty) fileService.writeObject(STORE_HISTORY_FILE, root);
  }

  private Map<String, Object> getTrackedNode(String trackKey, String store) {
    Map<String, Object> root = fileService.readObject(STORE_HISTORY_FILE);
    Map<String, Object> bucket = asMap(root.get(trackKey));
    return asMap(bucket.get(str(store).toLowerCase(Locale.ROOT).trim()));
  }

  private String normalizeTrackKey(Object trackKeyIn, String product, String store) {
    String explicit = str(trackKeyIn).trim();
    if (!explicit.isBlank()) return PriceUtils.normalizeProductKey(explicit);
    return PriceUtils.normalizeProductKey(product) + "__" + str(store).toLowerCase(Locale.ROOT).trim();
  }

  private String str(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String nullableTrim(Object value) {
    String out = str(value).trim();
    return out.isBlank() ? null : out;
  }

  private Integer toInt(Object value) {
    if (value == null) return null;
    if (value instanceof Number n) return (int) Math.round(n.doubleValue());
    try {
      return (int) Math.round(Double.parseDouble(str(value)));
    } catch (Exception e) {
      return null;
    }
  }

  private Double toDouble(Object value) {
    if (value == null) return null;
    if (value instanceof Number n) return n.doubleValue();
    try {
      return Double.parseDouble(str(value));
    } catch (Exception e) {
      return null;
    }
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> asMap(Object value) {
    if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
    return new LinkedHashMap<>();
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> asListOfMap(Object value) {
    if (value instanceof List<?> list) {
      return new ArrayList<>(list.stream()
        .filter(item -> item instanceof Map<?, ?>)
        .map(item -> (Map<String, Object>) item)
        .toList());
    }
    return new ArrayList<>();
  }
}
