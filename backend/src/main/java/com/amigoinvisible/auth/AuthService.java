package com.amigoinvisible.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.config.AppProperties;

/** Abre y comprueba sesiones (tokens Bearer) de participantes y de organización. */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String DEV_PASSWORD = "turron";

    static final String PARTICIPANT_EXPIRED = "Tu sesión ha caducado. Vuelve a entrar con tu código.";
    static final String ADMIN_ONLY = "Solo quien organiza puede hacer esto.";

    private final AppSessionRepository sessions;
    private final AppProperties props;
    private final Clock clock;

    public AuthService(AppSessionRepository sessions, AppProperties props, Clock clock) {
        this.sessions = sessions;
        this.props = props;
        this.clock = clock;
        if (DEV_PASSWORD.equals(props.adminPassword())) {
            log.warn("La contraseña de organización es la de desarrollo. En producción define ADMIN_PASSWORD.");
        }
    }

    @Transactional
    public String openParticipantSession(String participantId) {
        Instant now = clock.instant();
        String token = newToken();
        sessions.save(AppSession.forParticipant(token, participantId, now, now.plus(props.sessionTtl())));
        return token;
    }

    @Transactional
    public String openAdminSession() {
        Instant now = clock.instant();
        String token = newToken();
        sessions.save(AppSession.forAdmin(token, now, now.plus(props.sessionTtl())));
        return token;
    }

    /** Compara en tiempo constante para no dar pistas por lo que tarda la respuesta. */
    public boolean isAdminPassword(String candidate) {
        if (candidate == null) {
            return false;
        }
        return MessageDigest.isEqual(
                candidate.getBytes(StandardCharsets.UTF_8), props.adminPassword().getBytes(StandardCharsets.UTF_8));
    }

    /** Exige una sesión de participante válida. Lanza 401 si no la hay. */
    @Transactional(readOnly = true)
    public AuthenticatedParticipant requireParticipant(String authorizationHeader) {
        AppSession session = validSession(authorizationHeader);
        if (session == null || session.isAdmin() || session.getParticipantId() == null) {
            throw ApiException.unauthorized(PARTICIPANT_EXPIRED);
        }
        return new AuthenticatedParticipant(session.getParticipantId());
    }

    /** Exige una sesión de organización válida. Lanza 401 si no la hay. */
    @Transactional(readOnly = true)
    public void requireAdmin(String authorizationHeader) {
        AppSession session = validSession(authorizationHeader);
        if (session == null || !session.isAdmin()) {
            throw ApiException.unauthorized(ADMIN_ONLY);
        }
    }

    /** Limpieza diaria de sesiones caducadas. */
    @Scheduled(cron = "0 30 4 * * *")
    @Transactional
    public void purgeExpiredSessions() {
        int removed = sessions.deleteExpired(clock.instant());
        if (removed > 0) {
            log.info("Sesiones caducadas borradas: {}", removed);
        }
    }

    private AppSession validSession(String authorizationHeader) {
        String token = bearerToken(authorizationHeader);
        if (token == null) {
            return null;
        }
        return sessions.findById(token).filter(s -> !s.isExpired(clock.instant())).orElse(null);
    }

    static String bearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = authorizationHeader.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
