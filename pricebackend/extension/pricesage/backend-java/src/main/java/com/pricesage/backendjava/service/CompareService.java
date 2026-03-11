package com.pricesage.backendjava.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CompareService {
  private static final String HISTORY_FILE = "price-history.json";
  private static final Pattern PRICE_PATTERN = Pattern.compile("(\\d+(?:\\.\\d+)?)");

  private final JsonFileService fileService;
  private final ObjectMapper mapper = new ObjectMapper();
  private final HttpClient httpClient = HttpClient.newHttpClient();
  private final Map<String, CacheEntry> compareCache = new ConcurrentHashMap<>();

  @Value("${pricesage.serp-api-key:${SERP_API_KEY:}}")
  private String serpApiKey;

  @Value("${pricesage.compare-cache-ttl-ms:180000}")
  private long compareCacheTtlMs;

  public CompareService(JsonFileService fileService) {
    this.fileService = fileService;
  }

  public Map<String, Object> compare(String rawUrl) {
    String url = String.valueOf(rawUrl == null ? "" : rawUrl).trim();
    if (url.isBlank()) throw new IllegalArgumentException("Product URL required");

    URI parsed;
    try {
      parsed = URI.create(url);
      parsed.toURL();
    } catch (Exception e) {
      throw new IllegalArgumentException("Please provide a valid product URL");
    }

    boolean listingFallbackMode = false;
    if (isListingOrSearchUrl(parsed)) {
      String resolved = resolveProductDetailUrlFromListing(parsed.toString());
      if (resolved == null) resolved = resolveProductDetailUrlFromListingFallback(parsed.toString());
      if (resolved == null) listingFallbackMode = true;
      else parsed = URI.create(resolved);
    }

    String cacheKey = normalizeUrlForCache(parsed.toString());
    CacheEntry cacheHit = getCompareCache(cacheKey);
    if (cacheHit != null) {
      Map<String, Object> out = new LinkedHashMap<>(cacheHit.payload);
      out.put("fetchedAt", Instant.now().toString());
      out.put("cache", Map.of("hit", true, "ageMs", Instant.now().toEpochMilli() - cacheHit.createdAt, "ttlMs", compareCacheTtlMs));
      return out;
    }

    String sourceStore = PriceUtils.detectStoreFromUrl(parsed.toString());
    String urlQuery = buildQueryFromUrl(parsed.toString());
    String fallbackQuery = (urlQuery == null || urlQuery.isBlank()) ? sourceStore + " product" : urlQuery;

    ScrapeResult scraped = listingFallbackMode
      ? new ScrapeResult(fallbackQuery, null, null, null, null, null)
      : scrapeProductFromUrl(parsed.toString());

    List<Offer> baseOffers = fetchMarketOffers(fallbackQuery, true);
    List<Offer> sourceFocusedOffers = fetchMarketOffers(sourceStore + " " + fallbackQuery, true);

    String query = isScrapedTitleUsable(scraped.product) ? scraped.product : fallbackQuery;
    if (query == null || query.isBlank()) throw new IllegalArgumentException("Could not identify product from the link");

    List<Offer> secondaryOffers = query.equalsIgnoreCase(fallbackQuery) ? new ArrayList<>() : fetchMarketOffers(query, true);
    List<Offer> stores = mergeOffers(baseOffers, sourceFocusedOffers, secondaryOffers);

    Offer sourceEntry = new Offer(
      sourceStore,
      scraped.sourcePrice,
      parsed.toString(),
      scraped.product != null ? scraped.product : query,
      scraped.details,
      scraped.image,
      scraped.sourceRating,
      scraped.sourceReviewCount,
      999
    );

    if (sourceEntry.price != null && sourceEntry.price > 0) {
      int index = -1;
      for (int i = 0; i < stores.size(); i++) {
        if (stores.get(i).store.equalsIgnoreCase(sourceStore)) {
          index = i;
          break;
        }
      }
      if (index >= 0) {
        Offer existing = stores.get(index);
        if (existing.price == null || sourceEntry.price < existing.price) {
          stores.set(index, sourceEntry);
        } else {
          stores.set(index, new Offer(existing.store, existing.price, parsed.toString(), existing.title, existing.details, existing.image, existing.rating, existing.reviewCount, existing.relevanceScore));
        }
      } else {
        stores.add(sourceEntry);
      }
    }

    if (scraped.sourcePrice != null && scraped.sourcePrice > 0) {
      double floorMultiplier = scraped.sourcePrice >= 20000 ? 0.72 : 0.55;
      int minReasonable = (int) Math.round(scraped.sourcePrice * floorMultiplier);
      stores = stores.stream()
        .filter(o -> o.store.equalsIgnoreCase(sourceStore) || (o.price != null && o.price >= minReasonable))
        .toList();
    }

    stores = stores.stream()
      .filter(o -> o.price != null && o.price > 0)
      .sorted(Comparator.comparingInt(o -> o.price))
      .collect(Collectors.collectingAndThen(Collectors.toMap(
        o -> o.store.toLowerCase(Locale.ROOT) + "__" + o.price,
        o -> o,
        (a, b) -> a,
        LinkedHashMap::new
      ), m -> new ArrayList<>(m.values())));

    FilterResult anomaly = filterAnomalousOffers(stores, sourceStore, scraped.sourcePrice);
    stores = anomaly.stores.stream()
      .filter(o -> o.price != null && o.price > 0)
      .sorted(Comparator.comparingInt(o -> o.price))
      .toList();

    if (stores.isEmpty() && scraped.sourcePrice != null) stores = List.of(sourceEntry);

    List<Offer> similarProducts = new ArrayList<>();
    if (stores.isEmpty()) {
      List<Offer> s1 = fetchMarketOffers(query, false);
      List<Offer> s2 = fetchMarketOffersViaGoogle(sourceStore + " " + query, false);
      List<Offer> s3 = fetchMarketOffersViaGoogle(query + " myntra meesho desertcart jiomart zepto", false);
      similarProducts = mergeSimilarOffers(s1, s2, s3).stream()
        .filter(o -> o.price != null && o.price > 0)
        .sorted((a, b) -> {
          int c = Double.compare(socialProofScore(b), socialProofScore(a));
          if (c != 0) return c;
          return Integer.compare(a.price, b.price);
        })
        .limit(12)
        .toList();
    }

    Integer sourcePrice = scraped.sourcePrice;
    if (sourcePrice == null) {
      for (Offer offer : stores) {
        if (offer.store.equalsIgnoreCase(sourceStore) && offer.price != null) {
          sourcePrice = offer.price;
          break;
        }
      }
    }

    Integer bestPrice = stores.isEmpty() ? null : stores.get(0).price;
    Integer highestPrice = stores.isEmpty() ? null : stores.get(stores.size() - 1).price;
    Map<String, Object> tracking = null;
    if (bestPrice != null && bestPrice > 0) {
      int trackingFloor = sourcePrice != null ? Math.max(1, (int) Math.round(sourcePrice * 0.55)) : 1;
      tracking = updateAndBuildTracking(PriceUtils.normalizeProductKey(query), bestPrice, stores.size(), trackingFloor);
    }

    boolean partial = stores.isEmpty();
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("product", query);
    out.put("productKey", PriceUtils.normalizeProductKey(query));
    out.put("sourceStore", sourceStore);
    out.put("sourcePrice", sourcePrice);
    out.put("bestPrice", bestPrice);
    out.put("savings", bestPrice != null && highestPrice != null ? highestPrice - bestPrice : 0);
    out.put("stores", offersToMaps(stores));
    out.put("similarProducts", offersToMaps(similarProducts));
    out.put("fetchedAt", Instant.now().toString());
    out.put("tracking", tracking);
    out.put("mode", "realtime-plus-market");
    out.put("partial", partial);
    out.put("anomalyFilteredCount", anomaly.removedCount);
    out.put("cache", Map.of("hit", false, "ttlMs", compareCacheTtlMs));
    if (partial) out.put("notice", "Limited data right now. Showing what could be fetched quickly.");
    else if (anomaly.removedCount > 0) out.put("notice", "Filtered " + anomaly.removedCount + " suspicious price result(s).");
    else out.put("notice", null);

    setCompareCache(cacheKey, out);
    return out;
  }

  private ScrapeResult scrapeProductFromUrl(String productUrl) {
    try {
      Document doc = Jsoup.connect(productUrl)
        .userAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(25000)
        .get();

      String title = firstText(doc, "#productTitle", ".VU-ZEz", "span.B_NuCI", "h1.product-title", "h1.pdp-title", "h1");
      if (title == null || title.isBlank()) title = attr(doc, "meta[property=og:title]", "content");
      if (title == null || title.isBlank()) title = doc.title();

      List<PriceCandidate> candidates = collectPriceCandidates(doc);
      Integer sourcePrice = pickLikelySourcePrice(candidates);

      String image = attr(doc, "meta[property=og:image]", "content");
      if (image == null || image.isBlank()) {
        Element img = doc.selectFirst("img[src]");
        image = img == null ? null : img.absUrl("src");
      }
      String details = attr(doc, "meta[name=description]", "content");
      Double rating = parseRating(attr(doc, "meta[itemprop=ratingValue]", "content"));
      Integer reviewCount = parseReviewCount(attr(doc, "meta[itemprop=reviewCount]", "content"));

      return new ScrapeResult(title, sourcePrice, image, details, rating, reviewCount);
    } catch (Exception e) {
      return new ScrapeResult(null, null, null, null, null, null);
    }
  }

  private List<Offer> fetchMarketOffers(String productName, boolean strict) {
    return fetchSerpOffers("google_shopping", productName, strict, false);
  }

  private List<Offer> fetchMarketOffersViaGoogle(String productName, boolean strict) {
    return fetchSerpOffers("google", productName, strict, true);
  }

  private List<Offer> fetchSerpOffers(String engine, String productName, boolean strict, boolean useTbmShop) {
    if (serpApiKey == null || serpApiKey.isBlank()) return new ArrayList<>();
    try {
      String querySeed = tokenizeQuery(productName).stream().limit(8).collect(Collectors.joining(" "));
      if (querySeed.isBlank()) querySeed = productName;
      StringBuilder url = new StringBuilder("https://serpapi.com/search.json");
      url.append("?engine=").append(enc(engine));
      if (useTbmShop) url.append("&tbm=shop");
      url.append("&q=").append(enc(querySeed));
      url.append("&api_key=").append(enc(serpApiKey));
      url.append("&gl=in&hl=en&num=45");

      HttpRequest req = HttpRequest.newBuilder(URI.create(url.toString())).GET().build();
      HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
      if (res.statusCode() < 200 || res.statusCode() >= 300) return new ArrayList<>();

      Map<String, Object> parsed = mapper.readValue(res.body(), new TypeReference<>() {});
      List<Map<String, Object>> results = asListOfMap(parsed.get("shopping_results"));
      Map<String, Offer> byStore = new HashMap<>();
      int minScore = strict ? 6 : 4;

      for (Map<String, Object> item : results) {
        String title = str(item.get("title"));
        if (title.isBlank()) title = str(item.get("product_title"));
        if (strict && !isLikelyMainProduct(productName, title)) continue;

        Integer price = parsePriceFromSerp(item);
        if (price == null || price <= 0) continue;

        String link = pickBestOfferLink(item, productName, str(item.get("source")));
        String store = inferStoreName(item, link);
        if (store == null) continue;
        if (!isLikelyIndianStore(store)) continue;
        if (strict && isLikelyResaleStore(store)) continue;

        int relevanceScore = scoreOfferRelevance(productName, title);
        if (strict && !hasIdentityMatch(productName, title)) continue;
        if (relevanceScore < minScore) continue;

        String details = str(item.get("snippet"));
        if (details.isBlank()) details = str(item.get("delivery"));
        if (details.isBlank()) details = str(item.get("shipping"));
        if (details.isBlank()) {
          List<String> ex = asList(item.get("extensions")).stream().map(this::str).filter(s -> !s.isBlank()).toList();
          details = String.join(" | ", ex);
        }
        if (details.isBlank()) details = null;

        String image = str(item.get("thumbnail"));
        if (image.isBlank()) image = str(item.get("image"));
        if (image.isBlank()) {
          List<Object> thumbs = asList(item.get("thumbnails"));
          if (!thumbs.isEmpty()) image = str(thumbs.get(0));
        }
        if (image.isBlank()) image = null;

        Double rating = parseRating(firstNonBlank(item, "rating", "extracted_rating", "product_rating", "seller_rating"));
        Integer reviewCount = parseReviewCount(firstNonBlank(item, "reviews", "reviews_count", "rating_count", "total_reviews", "extracted_reviews"));
        Offer offer = new Offer(store, price, link, title.isBlank() ? null : title, details, image, rating, reviewCount, relevanceScore);

        Offer existing = byStore.get(store.toLowerCase(Locale.ROOT));
        if (existing == null || offer.relevanceScore > existing.relevanceScore
          || (Objects.equals(offer.relevanceScore, existing.relevanceScore) && offer.price < existing.price)) {
          byStore.put(store.toLowerCase(Locale.ROOT), offer);
        }
      }

      return byStore.values().stream().sorted(Comparator.comparingInt(o -> o.price)).toList();
    } catch (Exception e) {
      return new ArrayList<>();
    }
  }

  private Map<String, Object> updateAndBuildTracking(String productKey, int bestPrice, int storesCount, int minValidPrice) {
    Map<String, Object> root = fileService.readObject(HISTORY_FILE);
    List<Map<String, Object>> list = asListOfMap(root.get(productKey)).stream()
      .filter(e -> {
        Integer p = toInt(e.get("bestPrice"));
        return p != null && p >= minValidPrice;
      })
      .collect(Collectors.toCollection(ArrayList::new));

    Map<String, Object> point = new LinkedHashMap<>();
    point.put("timestamp", Instant.now().toString());
    point.put("bestPrice", bestPrice);
    point.put("storesCount", storesCount);
    list.add(point);
    if (list.size() > 120) list = new ArrayList<>(list.subList(list.size() - 120, list.size()));
    root.put(productKey, list);
    fileService.writeObject(HISTORY_FILE, root);

    int low = list.stream().map(x -> toInt(x.get("bestPrice"))).filter(Objects::nonNull).min(Integer::compareTo).orElse(bestPrice);
    int high = list.stream().map(x -> toInt(x.get("bestPrice"))).filter(Objects::nonNull).max(Integer::compareTo).orElse(bestPrice);
    String trend = "Collecting baseline";
    if (list.size() >= 3) {
      int n = list.size();
      int a = toInt(list.get(n - 3).get("bestPrice"));
      int b = toInt(list.get(n - 2).get("bestPrice"));
      int c = toInt(list.get(n - 1).get("bestPrice"));
      if (c < b && b <= a) trend = "Price is trending down";
      else if (c > b && b >= a) trend = "Price is trending up";
      else trend = "Price is mostly stable";
    }

    List<Map<String, Object>> recent = list.size() > 10 ? list.subList(list.size() - 10, list.size()) : list;
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("trend", trend);
    out.put("lowestSeen", low);
    out.put("highestSeen", high);
    out.put("samples", list.size());
    out.put("history", recent);
    return out;
  }

  private boolean isListingOrSearchUrl(URI parsedUrl) {
    try {
      String path = str(parsedUrl.getPath()).toLowerCase(Locale.ROOT);
      String host = str(parsedUrl.getHost()).toLowerCase(Locale.ROOT);
      if (path.isBlank()) return false;
      if (path.equals("/") || path.startsWith("/search") || path.startsWith("/s") || path.startsWith("/gp/search")
        || path.startsWith("/collections") || path.startsWith("/category")) return true;
      return host.contains("flipkart.com") && path.startsWith("/search");
    } catch (Exception e) {
      return false;
    }
  }

  private boolean isLikelyProductPath(String pathname) {
    String path = str(pathname).toLowerCase(Locale.ROOT);
    if (path.isBlank() || "/".equals(path)) return false;
    List<String> productHints = List.of("/dp/", "/gp/product", "/p/", "/product/", "/products/", "/item/", "/itm/");
    List<String> blocked = List.of("/search", "/s?", "/collections", "/category", "/cart", "/checkout", "/login", "/account");
    if (blocked.stream().anyMatch(path::contains)) return false;
    return productHints.stream().anyMatch(path::contains);
  }

  private String resolveProductDetailUrlFromListing(String listingUrl) {
    try {
      Document doc = Jsoup.connect(listingUrl).userAgent("Mozilla/5.0").timeout(25000).get();
      URI base = URI.create(listingUrl);
      String baseHost = str(base.getHost()).toLowerCase(Locale.ROOT);
      Element best = null;
      int bestScore = Integer.MIN_VALUE;
      for (Element a : doc.select("a[href]")) {
        String href = a.absUrl("href");
        if (href == null || href.isBlank()) continue;
        URI u = parseUri(href);
        if (u == null || !str(u.getHost()).toLowerCase(Locale.ROOT).equals(baseHost)) continue;
        String path = str(u.getPath()).toLowerCase(Locale.ROOT);
        if (!isLikelyProductPath(path)) continue;
        int score = 0;
        if (path.contains("/dp/") || path.contains("/p/") || path.contains("/itm/")) score += 5;
        if (a.selectFirst("img") != null) score += 3;
        if (a.text().trim().length() >= 12) score += 3;
        if (score > bestScore) {
          best = a;
          bestScore = score;
        }
      }
      return best == null ? null : best.absUrl("href");
    } catch (Exception e) {
      return null;
    }
  }

  private String resolveProductDetailUrlFromListingFallback(String listingUrl) {
    try {
      URI parsed = URI.create(listingUrl);
      String listingHostRoot = hostRoot(str(parsed.getHost()));
      String listingQuery = extractQueryParam(parsed, "q");
      if (listingQuery == null) listingQuery = extractQueryParam(parsed, "query");
      if (listingQuery == null) listingQuery = extractQueryParam(parsed, "k");
      if (listingQuery == null) listingQuery = buildQueryFromUrl(listingUrl);
      if (listingQuery == null) listingQuery = PriceUtils.detectStoreFromUrl(listingUrl) + " product";

      List<Offer> offers = new ArrayList<>();
      offers.addAll(fetchMarketOffersViaGoogle(listingQuery, false));
      offers.addAll(fetchMarketOffersViaGoogle(PriceUtils.detectStoreFromUrl(listingUrl) + " " + listingQuery, false));

      for (Offer item : offers) {
        URI candidate = parseUri(item.link);
        if (candidate == null) continue;
        if (!hostRoot(str(candidate.getHost())).equalsIgnoreCase(listingHostRoot)) continue;
        if (!isLikelyProductPath(candidate.getPath())) continue;
        return candidate.toString();
      }
      for (Offer item : offers) {
        URI candidate = parseUri(item.link);
        if (candidate != null && isLikelyProductPath(candidate.getPath())) return candidate.toString();
      }
      return null;
    } catch (Exception e) {
      return null;
    }
  }

  private String buildQueryFromUrl(String productUrl) {
    try {
      String path = str(URI.create(productUrl).getPath());
      String chunk = null;
      for (String part : path.split("/")) {
        if (part.contains("-") && part.length() > 8) {
          chunk = part;
          break;
        }
      }
      if (chunk == null) return null;
      return chunk.replace("-", " ").replace("_", " ")
        .replaceAll("\\b(dp|p|itm|gp|product)\\b", " ")
        .replaceAll("\\s+", " ")
        .trim();
    } catch (Exception e) {
      return null;
    }
  }

  private boolean isScrapedTitleUsable(String title) {
    String t = str(title).trim().toLowerCase(Locale.ROOT);
    if (t.isBlank()) return false;
    List<String> blocked = List.of("are you a human", "captcha", "access denied", "robot", "just a moment", "attention required",
      "online shopping", "@ flipkart", "flipkart.com", "amazon.in", "buy products online");
    if (blocked.stream().anyMatch(t::contains)) return false;
    return t.length() >= 6;
  }

  private List<Offer> mergeOffers(List<Offer>... offerLists) {
    Map<String, Offer> byStore = new HashMap<>();
    for (List<Offer> list : offerLists) {
      for (Offer offer : list) {
        if (offer == null || offer.store == null || offer.price == null) continue;
        String key = offer.store.toLowerCase(Locale.ROOT);
        Offer current = byStore.get(key);
        boolean replace = current == null
          || offer.relevanceScore > current.relevanceScore
          || (Objects.equals(offer.relevanceScore, current.relevanceScore) && offer.price < current.price)
          || (Objects.equals(offer.relevanceScore, current.relevanceScore) && Objects.equals(offer.price, current.price)
          && socialProofScore(offer) > socialProofScore(current));
        if (replace) byStore.put(key, offer);
      }
    }
    return new ArrayList<>(byStore.values());
  }

  private List<Offer> mergeSimilarOffers(List<Offer>... offerLists) {
    Map<String, Offer> byKey = new LinkedHashMap<>();
    for (List<Offer> list : offerLists) {
      for (Offer offer : list) {
        if (offer == null || offer.store == null || offer.price == null) continue;
        String linkKey = str(offer.link).trim().toLowerCase(Locale.ROOT);
        String titleKey = normalizeText(offer.title);
        String key = linkKey.isBlank() ? offer.store.toLowerCase(Locale.ROOT) + "__" + titleKey : linkKey;
        Offer current = byKey.get(key);
        if (current == null
          || socialProofScore(offer) > socialProofScore(current)
          || (Objects.equals(socialProofScore(offer), socialProofScore(current)) && offer.price < current.price)) {
          byKey.put(key, offer);
        }
      }
    }
    return new ArrayList<>(byKey.values());
  }

  private FilterResult filterAnomalousOffers(List<Offer> stores, String sourceStore, Integer sourcePrice) {
    List<Offer> list = stores.stream().filter(o -> o.price != null && o.price > 0).toList();
    if (list.size() <= 2) return new FilterResult(list, 0);
    Integer median = median(list.stream().map(o -> o.price).toList());
    if (median == null || median <= 0) return new FilterResult(list, 0);

    int lowerFromMedian = (int) Math.round(median * 0.45);
    int upperFromMedian = (int) Math.round(median * 2.2);
    int lowerFromSource = sourcePrice != null ? (int) Math.round(sourcePrice * 0.45) : 1;
    int upperFromSource = sourcePrice != null ? (int) Math.round(sourcePrice * 2.2) : Integer.MAX_VALUE;
    int lowerBound = Math.max(1, Math.max(lowerFromMedian, lowerFromSource));
    int upperBound = Math.min(upperFromMedian, upperFromSource);
    if (upperBound <= lowerBound) return new FilterResult(list, 0);

    List<Offer> filtered = list.stream().filter(o -> {
      if (o.store.equalsIgnoreCase(sourceStore)) return true;
      return o.price >= lowerBound && o.price <= upperBound;
    }).toList();
    if (filtered.isEmpty()) return new FilterResult(list, 0);
    return new FilterResult(filtered, Math.max(0, list.size() - filtered.size()));
  }

  private Integer median(List<Integer> values) {
    List<Integer> clean = values.stream().filter(v -> v != null && v > 0).sorted().toList();
    if (clean.isEmpty()) return null;
    int mid = clean.size() / 2;
    if (clean.size() % 2 == 0) return (int) Math.round((clean.get(mid - 1) + clean.get(mid)) / 2.0);
    return clean.get(mid);
  }

  private boolean isLikelyMainProduct(String query, String resultTitle) {
    String lower = normalizeText(resultTitle);
    if (lower.isBlank()) return false;
    List<String> blocked = List.of("case", "cover", "tempered", "protector", "screen guard", "cable", "charger",
      "adapter", "back cover", "skin", "replacement", "refurbished", "used", "pre owned", "pre-owned", "renewed", "exchange");
    if (blocked.stream().anyMatch(lower::contains)) return false;

    List<String> tokens = tokenizeQuery(query);
    List<String> strong = tokens.stream().filter(t -> t.length() >= 5 || t.matches(".*\\d.*")).toList();
    int tokenMatches = (int) tokens.stream().limit(8).filter(lower::contains).count();
    int strongMatches = (int) strong.stream().filter(lower::contains).count();
    int minTokenMatch = tokens.size() >= 4 ? 2 : 1;
    int relevance = scoreOfferRelevance(query, resultTitle);
    return tokenMatches >= minTokenMatch && (strong.isEmpty() || strongMatches >= 1) && relevance >= 6 && hasIdentityMatch(query, resultTitle);
  }

  private int scoreOfferRelevance(String query, String title) {
    String t = normalizeText(title);
    if (t.isBlank()) return 0;
    List<String> tokens = tokenizeQuery(query);
    List<String> strong = tokens.stream().filter(tok -> tok.length() >= 5 || tok.matches(".*\\d.*")).toList();
    long tokenMatches = tokens.stream().distinct().filter(t::contains).count();
    long strongMatches = strong.stream().distinct().filter(t::contains).count();
    long modelMatches = strong.stream().filter(tok -> tok.matches(".*\\d.*") && tok.matches(".*[a-zA-Z].*")).distinct().filter(t::contains).count();
    return (int) (tokenMatches * 2 + strongMatches * 4 + modelMatches * 5);
  }

  private boolean hasIdentityMatch(String query, String resultTitle) {
    String title = normalizeText(resultTitle);
    if (title.isBlank()) return false;
    List<String> queryTokens = tokenizeQuery(normalizeText(query));
    List<String> alphaNum = queryTokens.stream().filter(t -> t.matches(".*\\d.*") && t.matches(".*[a-zA-Z].*") && t.length() >= 3).toList();
    List<String> numeric = queryTokens.stream().filter(t -> t.matches("^\\d{4,}$")).toList();
    List<String> brands = List.of("apple", "iphone", "samsung", "vivo", "oppo", "oneplus", "xiaomi", "redmi", "realme", "nothing",
      "motorola", "moto", "google", "pixel", "nokia", "asus", "lenovo", "hp", "dell", "acer", "sony")
      .stream().filter(b -> normalizeText(query).contains(b)).toList();

    if (!brands.isEmpty() && brands.stream().noneMatch(title::contains)) return false;
    if (!alphaNum.isEmpty() && alphaNum.stream().noneMatch(title::contains)) return false;
    if (alphaNum.isEmpty() && !numeric.isEmpty() && numeric.stream().noneMatch(title::contains)) return false;
    return true;
  }

  private List<String> tokenizeQuery(String input) {
    Set<String> stop = Set.of("with", "for", "the", "and", "like", "new", "from", "men", "women");
    String n = normalizeText(input);
    if (n.isBlank()) return new ArrayList<>();
    return List.of(n.split("\\s+")).stream().filter(t -> t.length() >= 2 && !stop.contains(t)).toList();
  }

  private String normalizeText(String v) {
    return str(v).toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
  }

  private boolean isLikelyIndianStore(String storeName) {
    String name = str(storeName).trim().toLowerCase(Locale.ROOT);
    if (name.isBlank()) return false;
    List<String> blocked = List.of(".ae", ".eu", ".de", ".uk", ".us", "global", "international");
    if (blocked.stream().anyMatch(name::contains)) return false;
    if (name.contains(".")) return name.endsWith(".in") || name.contains("amazon.in");
    return true;
  }

  private boolean isLikelyResaleStore(String storeName) {
    String name = str(storeName).toLowerCase(Locale.ROOT).trim();
    List<String> hints = List.of("cashify", "gameloot", "gadget", "exchange", "used", "renew", "refurb", "second hand", "pre owned", "pre-owned");
    return hints.stream().anyMatch(name::contains);
  }

  private String pickBestOfferLink(Map<String, Object> item, String productName, String store) {
    List<String> candidates = List.of(str(item.get("merchant_link")), str(item.get("offer_link")), str(item.get("product_link")),
      str(item.get("source_link")), str(item.get("link")), str(item.get("serpapi_link"))).stream().filter(s -> !s.isBlank()).toList();
    for (String c : candidates) {
      URI u = parseUri(c);
      if (u != null && !isGoogleHost(u.getHost())) return c;
    }
    for (String c : candidates) {
      URI u = parseUri(c);
      if (u != null && isGoogleHost(u.getHost())) return c;
    }
    String q = productName + " " + store + " buy online";
    return "https://www.google.com/search?tbm=shop&q=" + enc(q);
  }

  private String inferStoreName(Map<String, Object> item, String link) {
    String direct = normalizeStoreName(firstNonBlank(item, "source", "merchant", "seller", "store", "shop"));
    if (direct != null) return direct;
    URI parsed = parseUri(link);
    if (parsed == null) return null;
    String host = str(parsed.getHost()).replaceFirst("^www\\.", "").toLowerCase(Locale.ROOT);
    if (host.isBlank()) return null;
    String label = host.split("\\.")[0];
    if (label.isBlank()) return null;
    return normalizeStoreName(label.substring(0, 1).toUpperCase(Locale.ROOT) + label.substring(1));
  }

  private String normalizeStoreName(String name) {
    String raw = str(name).trim();
    if (raw.isBlank()) return null;
    Map<String, String> aliases = Map.of(
      "jiomart marketplace", "JioMart",
      "jiomart", "JioMart",
      "desertcart.in", "Desertcart",
      "desertcart", "Desertcart",
      "myntra.com", "Myntra",
      "myntra", "Myntra",
      "meesho.com", "Meesho",
      "meesho", "Meesho",
      "zepto.com", "Zepto",
      "zepto", "Zepto"
    );
    return aliases.getOrDefault(raw.toLowerCase(Locale.ROOT), raw);
  }

  private boolean isGoogleHost(String hostname) {
    String h = str(hostname).toLowerCase(Locale.ROOT);
    return h.contains("google.") || h.contains("gstatic.com") || h.contains("googleadservices.com");
  }

  private Integer pickLikelySourcePrice(List<PriceCandidate> candidates) {
    List<ScoredPrice> ranked = new ArrayList<>();
    for (PriceCandidate c : candidates) {
      Integer price = parsePrice(c.text, true);
      if (price == null || price <= 0) continue;
      if (hasPriceNoise(c.text)) continue;
      if ("old".equalsIgnoreCase(c.kind)) continue;
      int score = 0;
      String lower = str(c.text).toLowerCase(Locale.ROOT);
      if (lower.contains("rs") || lower.contains("inr")) score += 4;
      if ("primary".equalsIgnoreCase(c.kind)) score += 5;
      if ("buy".equalsIgnoreCase(c.kind)) score += 6;
      if ("jsonld".equalsIgnoreCase(c.kind)) score += 7;
      if (price >= 100) score += 1;
      ranked.add(new ScoredPrice(score, price, c.kind));
    }
    if (ranked.isEmpty()) return null;
    ranked.sort((a, b) -> {
      int c = Integer.compare(b.score, a.score);
      return c != 0 ? c : Integer.compare(a.price, b.price);
    });
    return ranked.get(0).price;
  }

  private boolean hasPriceNoise(String raw) {
    String t = str(raw).toLowerCase(Locale.ROOT);
    List<String> hints = List.of("emi", "/month", "per month", "off", "discount", "save", "coupon", "cashback", "protect promise");
    return hints.stream().anyMatch(t::contains);
  }

  private List<PriceCandidate> collectPriceCandidates(Document doc) {
    List<PriceCandidate> out = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    addFromSelectors(doc, out, seen, List.of(".a-price .a-offscreen", "#priceblock_ourprice", "#priceblock_dealprice",
      "div.Nx9bqj.CxhGGd", "div.Nx9bqj", "._30jeq3._16Jk6d", "._30jeq3", "[itemprop=price]"), "primary");
    addFromSelectors(doc, out, seen, List.of("._3I9_wc", "._2p6lqe", ".yRaY8j", ".old-price", ".strike"), "old");
    addFromSelectors(doc, out, seen, List.of(".price", ".a-price-whole"), "secondary");
    String metaPrice = attr(doc, "meta[property=product:price:amount]", "content");
    if (metaPrice != null) out.add(new PriceCandidate("meta-price", metaPrice, "jsonld"));
    String text = doc.body() == null ? "" : doc.body().text();
    Matcher m = Pattern.compile("(?:rs\\.?|inr)\\s?[\\d,]+", Pattern.CASE_INSENSITIVE).matcher(text);
    int count = 0;
    while (m.find() && count < 3) {
      out.add(new PriceCandidate("body", m.group(), "secondary"));
      count++;
    }
    return out;
  }

  private void addFromSelectors(Document doc, List<PriceCandidate> out, Set<String> seen, List<String> selectors, String kind) {
    for (String selector : selectors) {
      for (Element node : doc.select(selector).stream().limit(5).toList()) {
        String text = node.text().trim();
        if (text.isBlank()) continue;
        String key = selector + "::" + text;
        if (seen.contains(key)) continue;
        seen.add(key);
        out.add(new PriceCandidate(selector, text, kind));
      }
    }
  }

  private Integer parsePriceFromSerp(Map<String, Object> item) {
    Integer fromPrice = parsePrice(firstNonBlank(item, "price"), false);
    if (fromPrice != null) return fromPrice;
    return parsePrice(firstNonBlank(item, "extracted_price"), true);
  }

  private Integer parsePrice(String raw, boolean allowUnknownCurrency) {
    if (raw == null || raw.isBlank()) return null;
    String source = raw.trim();
    String lower = source.toLowerCase(Locale.ROOT);
    boolean hasInr = lower.contains("rs") || lower.contains("inr") || lower.contains("rupee");
    boolean hasNonInr = List.of("$", "usd", "eur", "aed", "sar", "qar", "omr", "kwd", "gbp", "cad", "aud", "jpy", "cny")
      .stream().anyMatch(lower::contains);
    if (!allowUnknownCurrency && hasNonInr && !hasInr) return null;

    Matcher matcher = PRICE_PATTERN.matcher(source.replace(",", ""));
    if (!matcher.find()) return null;
    try {
      double value = Double.parseDouble(matcher.group(1));
      if (!Double.isFinite(value) || value <= 0) return null;
      return (int) Math.round(value);
    } catch (Exception e) {
      return null;
    }
  }

  private Double parseRating(String raw) {
    if (raw == null || raw.isBlank()) return null;
    Matcher m = PRICE_PATTERN.matcher(raw.trim());
    if (!m.find()) return null;
    double v = Double.parseDouble(m.group(1));
    if (!Double.isFinite(v) || v <= 0 || v > 5.1) return null;
    return Math.round(v * 10.0) / 10.0;
  }

  private Integer parseReviewCount(String raw) {
    if (raw == null || raw.isBlank()) return null;
    String t = raw.trim().toLowerCase(Locale.ROOT);
    Matcher compact = Pattern.compile("(\\d+(?:\\.\\d+)?)\\s*([km])").matcher(t);
    if (compact.find()) {
      double base = Double.parseDouble(compact.group(1));
      int mul = compact.group(2).equalsIgnoreCase("m") ? 1_000_000 : 1_000;
      return (int) Math.round(base * mul);
    }
    String digits = t.replaceAll("[^0-9]", "");
    if (digits.isBlank()) return null;
    try {
      return Integer.parseInt(digits);
    } catch (Exception e) {
      return null;
    }
  }

  private double socialProofScore(Offer offer) {
    double rating = offer.rating == null ? 0 : offer.rating;
    double reviewCount = offer.reviewCount == null ? 0 : offer.reviewCount;
    return rating * 20 + Math.log10(reviewCount + 1);
  }

  private String normalizeUrlForCache(String url) {
    try {
      URI parsed = URI.create(url);
      String query = str(parsed.getQuery());
      String base = parsed.getScheme() + "://" + parsed.getHost() + str(parsed.getPath());
      if (query.isBlank()) return base.toLowerCase(Locale.ROOT);

      List<String> kept = new ArrayList<>();
      for (String part : query.split("&")) {
        String[] kv = part.split("=", 2);
        String key = kv.length > 0 ? kv[0].toLowerCase(Locale.ROOT) : "";
        if (key.startsWith("utm_")) continue;
        if (Set.of("ref", "tag", "pf_rd_p", "pf_rd_r", "pf_rd_s", "pf_rd_t", "psc").contains(key)) continue;
        kept.add(part);
      }
      kept.sort(String::compareTo);
      return (base + (kept.isEmpty() ? "" : "?" + String.join("&", kept))).toLowerCase(Locale.ROOT);
    } catch (Exception e) {
      return str(url).trim().toLowerCase(Locale.ROOT);
    }
  }

  private CacheEntry getCompareCache(String cacheKey) {
    CacheEntry e = compareCache.get(cacheKey);
    if (e == null) return null;
    if (Instant.now().toEpochMilli() - e.createdAt > compareCacheTtlMs) {
      compareCache.remove(cacheKey);
      return null;
    }
    return e;
  }

  private void setCompareCache(String key, Map<String, Object> payload) {
    compareCache.put(key, new CacheEntry(Instant.now().toEpochMilli(), payload));
    if (compareCache.size() > 250) {
      String oldestKey = compareCache.entrySet().stream()
        .min(Comparator.comparingLong(x -> x.getValue().createdAt))
        .map(Map.Entry::getKey)
        .orElse(null);
      if (oldestKey != null) compareCache.remove(oldestKey);
    }
  }

  private List<Map<String, Object>> offersToMaps(List<Offer> offers) {
    List<Map<String, Object>> out = new ArrayList<>();
    for (Offer o : offers) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("store", o.store);
      row.put("price", o.price);
      row.put("link", o.link);
      row.put("title", o.title);
      row.put("details", o.details);
      row.put("image", o.image);
      row.put("rating", o.rating);
      row.put("reviewCount", o.reviewCount);
      out.add(row);
    }
    return out;
  }

  private String firstText(Document doc, String... selectors) {
    for (String selector : selectors) {
      Element el = doc.selectFirst(selector);
      if (el != null && !el.text().isBlank()) return el.text().trim();
    }
    return null;
  }

  private String attr(Document doc, String selector, String attr) {
    Element el = doc.selectFirst(selector);
    if (el == null) return null;
    String value = el.attr(attr);
    return value == null || value.isBlank() ? null : value.trim();
  }

  private URI parseUri(String input) {
    try {
      URI u = URI.create(str(input));
      if (u.getScheme() == null || u.getHost() == null) return null;
      return u;
    } catch (Exception e) {
      return null;
    }
  }

  private String extractQueryParam(URI uri, String key) {
    String q = str(uri.getQuery());
    for (String part : q.split("&")) {
      String[] kv = part.split("=", 2);
      if (kv.length == 2 && kv[0].equalsIgnoreCase(key)) {
        return java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
      }
    }
    return null;
  }

  private String hostRoot(String host) {
    String h = str(host).replaceFirst("^www\\.", "").toLowerCase(Locale.ROOT);
    String[] parts = h.split("\\.");
    if (parts.length < 2) return h;
    return parts[parts.length - 2] + "." + parts[parts.length - 1];
  }

  private String enc(String value) {
    return URLEncoder.encode(str(value), StandardCharsets.UTF_8);
  }

  private String str(Object value) {
    return value == null ? "" : String.valueOf(value);
  }

  private String firstNonBlank(Map<String, Object> map, String... keys) {
    for (String k : keys) {
      String v = str(map.get(k)).trim();
      if (!v.isBlank()) return v;
    }
    return "";
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, Object>> asListOfMap(Object value) {
    if (value instanceof List<?> list) {
      List<Map<String, Object>> out = new ArrayList<>();
      for (Object item : list) {
        if (item instanceof Map<?, ?> m) out.add((Map<String, Object>) m);
      }
      return out;
    }
    return new ArrayList<>();
  }

  @SuppressWarnings("unchecked")
  private List<Object> asList(Object value) {
    if (value instanceof List<?> list) return (List<Object>) list;
    return new ArrayList<>();
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

  private static final class ScrapeResult {
    private final String product;
    private final Integer sourcePrice;
    private final String image;
    private final String details;
    private final Double sourceRating;
    private final Integer sourceReviewCount;

    private ScrapeResult(String product, Integer sourcePrice, String image, String details, Double sourceRating, Integer sourceReviewCount) {
      this.product = product;
      this.sourcePrice = sourcePrice;
      this.image = image;
      this.details = details;
      this.sourceRating = sourceRating;
      this.sourceReviewCount = sourceReviewCount;
    }
  }

  private static final class PriceCandidate {
    private final String source;
    private final String text;
    private final String kind;

    private PriceCandidate(String source, String text, String kind) {
      this.source = source;
      this.text = text;
      this.kind = kind;
    }
  }

  private static final class ScoredPrice {
    private final int score;
    private final int price;
    private final String kind;

    private ScoredPrice(int score, int price, String kind) {
      this.score = score;
      this.price = price;
      this.kind = kind;
    }
  }

  private static final class Offer {
    private final String store;
    private final Integer price;
    private final String link;
    private final String title;
    private final String details;
    private final String image;
    private final Double rating;
    private final Integer reviewCount;
    private final Integer relevanceScore;

    private Offer(String store, Integer price, String link, String title, String details, String image, Double rating, Integer reviewCount, Integer relevanceScore) {
      this.store = store;
      this.price = price;
      this.link = link;
      this.title = title;
      this.details = details;
      this.image = image;
      this.rating = rating;
      this.reviewCount = reviewCount;
      this.relevanceScore = relevanceScore;
    }
  }

  private static final class FilterResult {
    private final List<Offer> stores;
    private final int removedCount;

    private FilterResult(List<Offer> stores, int removedCount) {
      this.stores = stores;
      this.removedCount = removedCount;
    }
  }

  private static final class CacheEntry {
    private final long createdAt;
    private final Map<String, Object> payload;

    private CacheEntry(long createdAt, Map<String, Object> payload) {
      this.createdAt = createdAt;
      this.payload = payload;
    }
  }
}
