package com.manju.pricebackend.controller;

import com.manju.pricebackend.service.BackendService;
import com.manju.pricebackend.service.CompareService;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ApiController {
  private final CompareService compareService;
  private final BackendService backendService;

  public ApiController(CompareService compareService, BackendService backendService) {
    this.compareService = compareService;
    this.backendService = backendService;
  }

  @GetMapping("/")
  public String root() {
    return "Backend working";
  }

  @PostMapping("/compare")
  public ResponseEntity<?> compare(@RequestBody(required = false) Map<String, Object> body) {
    try {
      String url = body == null ? null : String.valueOf(body.getOrDefault("url", ""));
      return ResponseEntity.ok(compareService.compare(url));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", e.getMessage() == null ? "Failed to compare live prices" : e.getMessage()));
    }
  }

  @PostMapping("/extension/capture")
  public ResponseEntity<?> saveCapture(@RequestBody(required = false) Map<String, Object> body) {
    try {
      return ResponseEntity.ok(backendService.saveCapture(body == null ? Map.of() : body));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Failed to save extension capture"));
    }
  }

  @GetMapping("/extension/captures")
  public ResponseEntity<?> getCaptures(@RequestParam(required = false) Integer limit) {
    try {
      return ResponseEntity.ok(backendService.getCaptures(limit == null ? 20 : limit));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Failed to load extension captures"));
    }
  }

  @PostMapping("/track-store")
  public ResponseEntity<?> trackStore(@RequestBody(required = false) Map<String, Object> body) {
    try {
      return ResponseEntity.ok(backendService.trackStore(body == null ? Map.of() : body));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Failed to track store price"));
    }
  }

  @PostMapping("/track-store/toggle")
  public ResponseEntity<?> trackToggle(@RequestBody(required = false) Map<String, Object> body) {
    try {
      return ResponseEntity.ok(backendService.toggleTracking(body == null ? Map.of() : body));
    } catch (IllegalArgumentException e) {
      if ("Tracked store not found".equalsIgnoreCase(e.getMessage())) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
      }
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "Failed to toggle tracked store"));
    }
  }

  @GetMapping("/track-store-history")
  public ResponseEntity<?> trackHistory(
    @RequestParam(required = false) String product,
    @RequestParam(required = false) String store,
    @RequestParam(required = false) String trackKey
  ) {
    try {
      return ResponseEntity.ok(backendService.getTrackHistory(product, store, trackKey));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to load tracked history"));
    }
  }

  @GetMapping("/price-insights")
  public ResponseEntity<?> priceInsights(
    @RequestParam(required = false) String product,
    @RequestParam(required = false) String store,
    @RequestParam(required = false) String trackKey
  ) {
    try {
      return ResponseEntity.ok(backendService.getPriceInsights(product, store, trackKey));
    } catch (IllegalArgumentException e) {
      return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to generate price insights"));
    }
  }

  @GetMapping("/notification-settings")
  public Map<String, Object> settings() {
    return backendService.getSettings();
  }

  @PostMapping("/notification-settings")
  public ResponseEntity<?> saveSettings(@RequestBody(required = false) Map<String, Object> body) {
    try {
      return ResponseEntity.ok(backendService.saveSettings(body == null ? Map.of() : body));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to save notification settings"));
    }
  }

  @GetMapping("/alerts")
  public ResponseEntity<?> alerts(
    @RequestParam(required = false) Integer limit,
    @RequestParam(required = false) String since
  ) {
    try {
      return ResponseEntity.ok(backendService.getAlerts(limit, since));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to load alerts"));
    }
  }

  @PostMapping("/alerts/mark-read")
  public ResponseEntity<?> markRead(@RequestBody(required = false) Map<String, Object> body) {
    try {
      String id = body == null ? null : String.valueOf(body.getOrDefault("id", ""));
      return ResponseEntity.ok(backendService.markAlertsRead(id));
    } catch (Exception e) {
      return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to update alerts"));
    }
  }
}


