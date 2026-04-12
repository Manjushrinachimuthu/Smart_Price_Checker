package com.manju.pricebackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/auth/**").permitAll()
                        .requestMatchers("/products/**").permitAll()
                        .requestMatchers(
                                "/",
                                "/compare",
                                "/extension/**",
                                "/track-store",
                                "/track-store/**",
                                "/track-store-history",
                                "/price-insights",
                                "/notification-settings",
                                "/alerts/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                );

        return http.build();
    }
}
