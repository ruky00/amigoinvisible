package com.amigoinvisible.draw;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Algoritmo del sorteo: port de src/lib/draw.ts del front.
 * Nadie se regala a sí mismo ni a alguien de sus exclusiones, y las exclusiones cuentan en
 * los dos sentidos (si Luna excluye a Carlos, a Carlos tampoco le puede tocar Luna).
 * Java puro, sin Spring, para poder probarlo a fondo con tests unitarios.
 */
public class DrawAlgorithm {

    static final String TOO_FEW = "Hacen falta al menos 3 personas para el sorteo.";
    static final String IMPOSSIBLE =
            "Con estas exclusiones no hay forma de hacer el sorteo. Quita alguna y prueba otra vez.";

    private static final int MAX_ATTEMPTS = 50;
    /**
     * Tope de pasos por intento. El original no lo tiene; aquí evita que un sorteo grande e
     * imposible deje el servidor pensando para siempre (el backtracking es exponencial).
     */
    private static final int MAX_STEPS_PER_ATTEMPT = 200_000;

    /** Una persona del sorteo: su id y los ids a los que no le puede tocar regalar. */
    public record Person(String id, Collection<String> exclusionIds) {
    }

    private final Random random;

    public DrawAlgorithm() {
        this(new SecureRandom());
    }

    /** Para los tests, que pueden pasar un Random con semilla. */
    public DrawAlgorithm(Random random) {
        this.random = random;
    }

    /** Devuelve giverId -> receiverId. Lanza {@link DrawException} si no se puede. */
    public Map<String, String> draw(List<Person> people) {
        if (people.size() < 3) {
            throw new DrawException(TOO_FEW);
        }

        Map<String, Set<String>> blocked = new HashMap<>();
        for (Person p : people) {
            Set<String> own = new HashSet<>();
            own.add(p.id());
            blocked.put(p.id(), own);
        }
        for (Person p : people) {
            if (p.exclusionIds() == null) {
                continue;
            }
            for (String other : p.exclusionIds()) {
                blocked.get(p.id()).add(other);
                Set<String> theirs = blocked.get(other);
                if (theirs != null) {
                    theirs.add(p.id());
                }
            }
        }

        // Backtracking sobre un orden aleatorio: con familias de tamaño normal es instantáneo.
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            List<String> givers = shuffle(people.stream().map(Person::id).toList());
            Attempt run = new Attempt(givers, blocked);
            if (run.assign(0)) {
                return run.result;
            }
        }
        throw new DrawException(IMPOSSIBLE);
    }

    /** Un intento de reparto con su propio estado. */
    private final class Attempt {
        private final List<String> givers;
        private final Map<String, Set<String>> blocked;
        private final Map<String, String> result = new LinkedHashMap<>();
        private final Set<String> taken = new HashSet<>();
        private int steps;

        Attempt(List<String> givers, Map<String, Set<String>> blocked) {
            this.givers = givers;
            this.blocked = blocked;
        }

        boolean assign(int i) {
            if (i == givers.size()) {
                return true;
            }
            String giver = givers.get(i);
            for (String receiver : shuffle(givers)) {
                if (++steps > MAX_STEPS_PER_ATTEMPT) {
                    return false;
                }
                if (taken.contains(receiver) || blocked.get(giver).contains(receiver)) {
                    continue;
                }
                result.put(giver, receiver);
                taken.add(receiver);
                if (assign(i + 1)) {
                    return true;
                }
                taken.remove(receiver);
                result.remove(giver);
            }
            return false;
        }
    }

    /** Fisher-Yates sobre una copia. */
    private List<String> shuffle(List<String> list) {
        List<String> copy = new ArrayList<>(list);
        for (int i = copy.size() - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            String tmp = copy.get(i);
            copy.set(i, copy.get(j));
            copy.set(j, tmp);
        }
        return copy;
    }
}
