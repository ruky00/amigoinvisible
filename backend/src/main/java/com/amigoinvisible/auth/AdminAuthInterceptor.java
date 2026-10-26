package com.amigoinvisible.auth;

import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/** Protege /api/admin/** (salvo el login): sin sesión de organización, 401. Ver WebConfig. */
@Component
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final AuthService auth;

    public AdminAuthInterceptor(AuthService auth) {
        this.auth = auth;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // las peticiones previas de CORS no llevan token
        if (CorsUtils.isPreFlightRequest(request)) {
            return true;
        }
        auth.requireAdmin(request.getHeader(HttpHeaders.AUTHORIZATION));
        return true;
    }
}
