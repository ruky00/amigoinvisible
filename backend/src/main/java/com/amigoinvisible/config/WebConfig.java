package com.amigoinvisible.config;

import java.util.List;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.amigoinvisible.auth.AdminAuthInterceptor;
import com.amigoinvisible.auth.AuthenticatedParticipantResolver;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AppProperties props;
    private final AdminAuthInterceptor adminAuthInterceptor;
    private final AuthenticatedParticipantResolver participantResolver;

    public WebConfig(
            AppProperties props,
            AdminAuthInterceptor adminAuthInterceptor,
            AuthenticatedParticipantResolver participantResolver) {
        this.props = props;
        this.adminAuthInterceptor = adminAuthInterceptor;
        this.participantResolver = participantResolver;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(props.cors().allowedOrigins().toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type")
                .maxAge(3600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Todo /api/admin/** exige sesión de organización, salvo el propio login
        registry.addInterceptor(adminAuthInterceptor)
                .addPathPatterns("/api/admin/**")
                .excludePathPatterns("/api/admin/login");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        // Permite declarar un parámetro AuthenticatedParticipant en los controladores de participante
        resolvers.add(participantResolver);
    }
}
