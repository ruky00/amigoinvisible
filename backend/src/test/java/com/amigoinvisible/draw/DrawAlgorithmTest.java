package com.amigoinvisible.draw;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;

import com.amigoinvisible.draw.DrawAlgorithm.Person;

class DrawAlgorithmTest {

    private final DrawAlgorithm algorithm = new DrawAlgorithm();

    @Test
    void everyoneGivesAndReceivesExactlyOnceAndNobodyToThemselves() {
        for (int size = 3; size <= 12; size++) {
            List<Person> people = new ArrayList<>();
            for (int i = 0; i < size; i++) {
                people.add(new Person("p" + i, List.of()));
            }
            for (int run = 0; run < 200; run++) {
                Map<String, String> pairs = algorithm.draw(people);
                Set<String> ids = new HashSet<>(people.stream().map(Person::id).toList());
                assertThat(pairs.keySet()).isEqualTo(ids);
                assertThat(new HashSet<>(pairs.values())).isEqualTo(ids);
                pairs.forEach((giver, receiver) -> assertThat(giver).isNotEqualTo(receiver));
            }
        }
    }

    @Test
    void exclusionsCountInBothDirections() {
        // Luna excluye a Carlos (solo lo dice ella); Abuela excluye a Paco
        List<Person> people = List.of(
                new Person("luna", List.of("carlos")),
                new Person("carlos", List.of()),
                new Person("abuela", List.of("paco")),
                new Person("paco", List.of()),
                new Person("marta", List.of()));
        for (int run = 0; run < 500; run++) {
            Map<String, String> pairs = algorithm.draw(people);
            assertThat(pairs.get("luna")).isNotEqualTo("carlos");
            assertThat(pairs.get("carlos")).isNotEqualTo("luna");
            assertThat(pairs.get("abuela")).isNotEqualTo("paco");
            assertThat(pairs.get("paco")).isNotEqualTo("abuela");
        }
    }

    @Test
    void tightButPossibleExclusionsStillWork() {
        // con 3 personas solo hay dos ciclos (a→b→c→a y a→c→b→a) y los dos usan a-b en algún sentido
        List<Person> people = List.of(
                new Person("a", List.of("b")),
                new Person("b", List.of()),
                new Person("c", List.of()));
        // a-b bloqueado en los dos sentidos: con 3 personas no hay solución
        assertThatThrownBy(() -> algorithm.draw(people))
                .isInstanceOf(DrawException.class)
                .hasMessage(DrawAlgorithm.IMPOSSIBLE);

        List<Person> four = List.of(
                new Person("a", List.of("b")),
                new Person("b", List.of()),
                new Person("c", List.of("d")),
                new Person("d", List.of()));
        for (int run = 0; run < 200; run++) {
            Map<String, String> pairs = algorithm.draw(four);
            assertThat(pairs.get("a")).isIn("c", "d");
            assertThat(pairs.get("c")).isIn("a", "b");
        }
    }

    @Test
    void lessThanThreePeopleIsAnError() {
        assertThatThrownBy(() -> algorithm.draw(List.of(new Person("a", List.of()), new Person("b", List.of()))))
                .isInstanceOf(DrawException.class)
                .hasMessage("Hacen falta al menos 3 personas para el sorteo.");
        assertThatThrownBy(() -> algorithm.draw(List.of()))
                .isInstanceOf(DrawException.class)
                .hasMessage(DrawAlgorithm.TOO_FEW);
    }

    @Test
    void impossibleExclusionsAreAnError() {
        // Luna excluye a todos los demás: nadie puede regalarle a ella
        List<Person> people = List.of(
                new Person("luna", List.of("carlos", "marta", "paco")),
                new Person("carlos", List.of()),
                new Person("marta", List.of()),
                new Person("paco", List.of()));
        assertThatThrownBy(() -> algorithm.draw(people))
                .isInstanceOf(DrawException.class)
                .hasMessage("Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.");
    }

    @Test
    void largeImpossibleDrawFailsInReasonableTime() {
        // 25 personas, una excluida por todos: el tope de pasos evita el backtracking eterno
        List<Person> people = new ArrayList<>();
        List<String> others = new ArrayList<>();
        for (int i = 1; i < 25; i++) {
            others.add("p" + i);
            people.add(new Person("p" + i, List.of()));
        }
        people.add(new Person("p0", others));
        long start = System.nanoTime();
        assertThatThrownBy(() -> algorithm.draw(people)).isInstanceOf(DrawException.class);
        assertThat(System.nanoTime() - start).isLessThan(30_000_000_000L);
    }
}
