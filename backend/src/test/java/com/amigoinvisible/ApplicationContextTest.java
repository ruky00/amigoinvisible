package com.amigoinvisible;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/** Arranca la aplicación entera: Flyway crea el esquema y Hibernate comprueba que encaja con las entidades. */
@SpringBootTest
@ActiveProfiles("test")
class ApplicationContextTest {

    @Test
    void contextLoads() {
    }
}
