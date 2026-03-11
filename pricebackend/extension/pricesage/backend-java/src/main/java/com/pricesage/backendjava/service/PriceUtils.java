package com.pricesage.backendjava.service;

import java.net.URI;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;

public final class PriceUtils {
  private PriceUtils() {}

  public static String detectStoreFromUrl(String url) {
    try {
      String host = URI.create(url).getHost();
      if (host == null || host.isBlank()) return "Store";
      String clean = host.replaceFirst("^www\\.", "");
      String[] parts = clean.split("\\.");
      if (parts.length == 0 || parts[0].isBlank()) return "Store";
      String head = parts[0];
      return head.substring(0, 1).toUpperCase(Locale.ROOT) + head.substring(1);
    } catch (Exception e) {
      return "Store";
    }
  }

  public static String normalizeProductKey(String input) {
    return String.valueOf(input == null ? "" : input)
      .toLowerCase(Locale.ROOT)
      .replaceAll("[^a-z0-9 ]", " ")
      .replaceAll("\\s+", " ")
      .trim();
  }

  public static Integer parsePrice(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String normalized = raw.replace(",", "");
    java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("(\\d+(?:\\.\\d+)?)").matcher(normalized);
    if (!matcher.find()) return null;
    try {
      double value = Double.parseDouble(matcher.group(1));
      if (value <= 0) return null;
      return (int) Math.round(value);
    } catch (Exception ignored) {
      return null;
    }
  }

  public static String nowIso() {
    return Instant.now().toString();
  }

  public static String todayUtc() {
    return LocalDate.now(ZoneOffset.UTC).toString();
  }
}
