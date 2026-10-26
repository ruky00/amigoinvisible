package com.amigoinvisible.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import com.amigoinvisible.domain.DrawEvent;
import com.amigoinvisible.domain.DrawEventRepository;
import com.amigoinvisible.domain.Participant;

/**
 * Arranca con app.demo-data=true. Cada contexto de test tiene su propia base vacía
 * (ver application-test.yml), así que aquí solo están los sorteos de ejemplo.
 */
@SpringBootTest(properties = "app.demo-data=true")
@ActiveProfiles("test")
class DemoDataLoaderTest {

    @Autowired
    DrawEventRepository events;

    @Autowired
    DemoDataLoader loader;

    @Autowired
    TransactionTemplate tx;

    @Test
    void loadsTheSameDemoDataAsTheFrontMock() {
        tx.executeWithoutResult(s -> {
            List<DrawEvent> all = events.findAllByOrderByCreatedAtDesc();
            assertThat(all).extracting(DrawEvent::getName)
                    .containsExactly("Camisetas raras · Equipo", "Papá Noel · Familia");

            DrawEvent team = all.get(0);
            assertThat(team.getBudget()).isEqualTo("15 €");
            assertThat(team.getExchangeDate()).isEqualTo(LocalDate.of(2026, 12, 19));
            assertThat(team.isDrawn()).isFalse();
            assertThat(codes(team)).containsExactly(
                    entry("Luna", "TRINEO-58"), entry("Dani", "COMETA-62"),
                    entry("Irene", "VELA-74"), entry("Rober", "BELEN-86"));
            assertThat(team.getParticipants()).allMatch(p -> p.getReceiverId() == null);

            DrawEvent family = all.get(1);
            assertThat(family.getBudget()).isEqualTo("25 €");
            assertThat(family.getExchangeDate()).isEqualTo(LocalDate.of(2026, 12, 24));
            assertThat(family.isDrawn()).isTrue();
            assertThat(codes(family)).containsExactly(
                    entry("Luna", "NIEVE-42"), entry("Carlos", "RENO-11"), entry("Abuela Carmen", "TURRON-23"),
                    entry("Tío Paco", "ACEBO-35"), entry("Marta", "ESTRELLA-47"));

            Map<String, String> pairs = family.getParticipants().stream()
                    .collect(Collectors.toMap(Participant::getId, Participant::getReceiverId));
            assertThat(new HashSet<>(pairs.values())).isEqualTo(pairs.keySet());
            pairs.forEach((giver, receiver) -> assertThat(giver).isNotEqualTo(receiver));

            Participant paco = family.getParticipants().get(3);
            assertThat(paco.getWishes()).extracting(w -> w.getText())
                    .containsExactly("Un buen jamón (o medio, no soy exigente)", "Bufanda de lana gris");
            assertThat(paco.getWishes()).extracting(w -> w.getUrl())
                    .containsExactly(null, "https://example.com/bufanda");
        });
    }

    @Test
    void doesNothingWhenThereAreEventsAlready() {
        long before = events.count();
        loader.run(new DefaultApplicationArguments());
        assertThat(events.count()).isEqualTo(before);
    }

    private static List<Map.Entry<String, String>> codes(DrawEvent event) {
        return event.getParticipants().stream().map(p -> entry(p.getName(), p.getCode())).toList();
    }

    private static Map.Entry<String, String> entry(String name, String code) {
        return Map.entry(name, code);
    }
}
