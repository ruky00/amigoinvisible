package com.amigoinvisible.auth;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.config.AppProperties;

/**
 * Frena a quien prueba códigos o contraseñas a lo loco: como mucho N intentos fallidos
 * por IP en la ventana configurada (app.login-rate-limit). Los códigos son cortos a propósito
 * (fáciles de dictar), así que esto es lo que evita que alguien los adivine probando.
 *
 * Uso en un login:
 * <pre>{@code
 * limiter.checkAllowed(ip);
 * if (fallo) { limiter.recordFailure(ip); throw ...; }
 * }</pre>
 * Vive en memoria: si se despliegan varias instancias, cada una lleva su cuenta.
 */
@Component
public class LoginRateLimiter {

    static final String TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a probar.";

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();
    private final AppProperties props;
    private final Clock clock;

    public LoginRateLimiter(AppProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
    }

    /** Lanza 429 si esa IP ya ha fallado demasiadas veces. */
    public void checkAllowed(String ip) {
        Deque<Instant> recent = failures.get(ip);
        if (recent == null) {
            return;
        }
        synchronized (recent) {
            prune(recent);
            if (recent.size() >= props.loginRateLimit().maxFailures()) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, TOO_MANY);
            }
        }
    }

    public void recordFailure(String ip) {
        Deque<Instant> recent = failures.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (recent) {
            prune(recent);
            recent.addLast(clock.instant());
        }
    }

    private void prune(Deque<Instant> recent) {
        Instant limit = clock.instant().minus(props.loginRateLimit().window());
        while (!recent.isEmpty() && recent.peekFirst().isBefore(limit)) {
            recent.pollFirst();
        }
    }
}
