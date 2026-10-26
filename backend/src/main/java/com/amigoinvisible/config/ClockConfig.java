package com.amigoinvisible.config;

import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {

    /** Reloj inyectable: en los tests se puede fijar la hora. */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }
}
