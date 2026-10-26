package com.amigoinvisible.admin;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.amigoinvisible.auth.AuthService;
import com.amigoinvisible.auth.LoginRateLimiter;
import com.amigoinvisible.common.ApiException;
import com.amigoinvisible.common.ClientIp;
import com.amigoinvisible.dto.AdminLoginRequest;
import com.amigoinvisible.dto.TokenResponse;

import jakarta.servlet.http.HttpServletRequest;

/** Entrada a la zona de organización. Es la única ruta de /api/admin que no pide token. */
@RestController
public class AdminLoginController {

    private final AuthService auth;
    private final LoginRateLimiter limiter;

    public AdminLoginController(AuthService auth, LoginRateLimiter limiter) {
        this.auth = auth;
        this.limiter = limiter;
    }

    @PostMapping("/api/admin/login")
    TokenResponse login(@RequestBody AdminLoginRequest body, HttpServletRequest request) {
        String ip = ClientIp.of(request);
        limiter.checkAllowed(ip);
        if (!auth.isAdminPassword(body.password())) {
            limiter.recordFailure(ip);
            throw ApiException.unauthorized("Contraseña incorrecta.");
        }
        return new TokenResponse(auth.openAdminSession());
    }
}
