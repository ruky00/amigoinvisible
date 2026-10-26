package com.amigoinvisible.auth;

import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/** Rellena los parámetros {@link AuthenticatedParticipant} de los controladores (o responde 401). */
@Component
public class AuthenticatedParticipantResolver implements HandlerMethodArgumentResolver {

    private final AuthService auth;

    public AuthenticatedParticipantResolver(AuthService auth) {
        this.auth = auth;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return AuthenticatedParticipant.class.equals(parameter.getParameterType());
    }

    @Override
    public AuthenticatedParticipant resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory) {
        return auth.requireParticipant(webRequest.getHeader(HttpHeaders.AUTHORIZATION));
    }
}
