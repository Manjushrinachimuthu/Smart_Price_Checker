package com.manju.pricebackend.config;

import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.core.env.Environment;

@Configuration
public class DataSourceFallbackConfig {

  private static final Logger log = LoggerFactory.getLogger(DataSourceFallbackConfig.class);

  private static final String FALLBACK_URL =
      "jdbc:h2:mem:pricebackend;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=MySQL";
  private static final String FALLBACK_USERNAME = "sa";
  private static final String FALLBACK_PASSWORD = "";
  private static final String FALLBACK_DRIVER = "org.h2.Driver";

  @Bean
  @Primary
  public DataSource dataSource(Environment environment) {
    DataSource primary = buildConfiguredDataSource(environment);
    if (canConnect(primary)) {
      log.debug("Using configured datasource ({})", environment.getProperty("spring.datasource.url"));
      return primary;
    }

    log.warn(
        "Configured datasource ({}) cannot be reached; falling back to embedded H2 for development.",
        environment.getProperty("spring.datasource.url"));

    return DataSourceBuilder.create()
        .driverClassName(FALLBACK_DRIVER)
        .url(FALLBACK_URL)
        .username(FALLBACK_USERNAME)
        .password(FALLBACK_PASSWORD)
        .build();
  }

  private DataSource buildConfiguredDataSource(Environment environment) {
    String url = environment.getProperty("spring.datasource.url");
    if (url == null || url.isBlank()) {
      return DataSourceBuilder.create().build();
    }

    return DataSourceBuilder.create()
        .url(url)
        .username(environment.getProperty("spring.datasource.username"))
        .password(environment.getProperty("spring.datasource.password"))
        .driverClassName(environment.getProperty("spring.datasource.driver-class-name"))
        .build();
  }

  private boolean canConnect(DataSource dataSource) {
    try (Connection ignored = dataSource.getConnection()) {
      return true;
    } catch (SQLException ex) {
      log.debug("Datasource connection check failed", ex);
      return false;
    }
  }
}
