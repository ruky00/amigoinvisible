package com.amigoinvisible.me;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.amigoinvisible.auth.AuthService;
import com.amigoinvisible.auth.LoginRateLimiter;
import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.common.ClientIp;
import com.amigoinvisible.dto.LoginRequest;
import com.amigoinvisible.dto.TokenResponse;

import jakarta.servlet.http.HttpServletRequest;

/** POST /api/login: entrar con el código que reparte la organización. */
@RestController
public class ParticipantLoginController {

    private final MeService me;
    private final AuthService auth;
    private final LoginRateLimiter limiter;

    public ParticipantLoginController(MeService me, AuthService auth, LoginRateLimiter limiter) {
        this.me = me;
        this.auth = auth;
        this.limiter = limiter;
    }

    @PostMapping("/api/login")
    TokenResponse login(@RequestBody(required = false) LoginRequest body, HttpServletRequest request) {
        String ip = ClientIp.of(request);
        limiter.checkAllowed(ip);
        String participantId;
        try {
            participantId = me.participantIdForCode(body == null ? null : body.code());
        } catch (ApiException e) {
            // cada código fallido cuenta: es lo que impide adivinarlos probando
            limiter.recordFailure(ip);
            throw e;
        }
        return new TokenResponse(auth.openParticipantSession(participantId));
    }
}
