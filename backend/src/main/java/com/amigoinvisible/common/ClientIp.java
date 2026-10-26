package com.amigoinvisible.common;

import jakarta.servlet.http.HttpServletRequest;

/**
 * IP del cliente, para limitar intentos de login.
 * Si se despliega detrás de un proxy (Cloudflare…), activar server.forward-headers-strategy
 * para que getRemoteAddr() devuelva la IP real.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        return request.getRemoteAddr();
    }
}
