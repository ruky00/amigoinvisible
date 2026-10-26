package com.amigoinvisible.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Configuración propia de la aplicación (bloque {@code app:} de application.yml). */
@ConfigurationProperties("app")
public record AppProperties(
        String adminPassword,
        Duration sessionTtl,
        LoginRateLimit loginRateLimit,
        Cors cors,
        boolean demoData) {

    /** Intentos fallidos de login permitidos por IP dentro de una ventana de tiempo. */
    public record LoginRateLimit(int maxFailures, Duration window) {
    }

    /** Orígenes (dominios del front) que pueden llamar a la API desde el navegador. */
    public record Cors(List<String> allowedOrigins) {
    }
}
