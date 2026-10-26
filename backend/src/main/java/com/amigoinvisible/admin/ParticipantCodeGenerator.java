package com.amigoinvisible.admin;

import java.security.SecureRandom;
import java.util.List;

import org.springframework.stereotype.Component;

import com.amigoinvisible.domain.ParticipantRepository;

/**
 * Códigos para entrar ("NIEVE-42"): una palabra navideña y un número, fáciles de dictar.
 * Únicos en TODA la base de datos, porque el código identifica a la persona y a su sorteo.
 */
@Component
public class ParticipantCodeGenerator {

    /** Las mismas palabras que el mock del front. */
    static final List<String> CODE_WORDS = List.of(
            "ABETO", "ACEBO", "BELEN", "CAMPANA", "COMETA", "ESTRELLA", "MAZAPAN", "MUERDAGO",
            "NIEVE", "PASTOR", "POLVORON", "RENO", "TRINEO", "TURRON", "VELA", "ZAMBOMBA");

    /** Con 16 palabras x 90 números hay 1440 códigos de dos cifras; si se llenan, pasamos a tres. */
    private static final int SHORT_ATTEMPTS = 30;

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ParticipantRepository participants;

    public ParticipantCodeGenerator(ParticipantRepository participants) {
        this.participants = participants;
    }

    public String newCode() {
        for (int i = 0; i < SHORT_ATTEMPTS; i++) {
            String code = candidate(10, 99);
            if (!participants.existsByCode(code)) {
                return code;
            }
        }
        while (true) {
            String code = candidate(100, 999);
            if (!participants.existsByCode(code)) {
                return code;
            }
        }
    }

    private static String candidate(int min, int max) {
        String word = CODE_WORDS.get(RANDOM.nextInt(CODE_WORDS.size()));
        return word + "-" + (min + RANDOM.nextInt(max - min + 1));
    }
}
