package com.amigoinvisible.common;

import java.util.UUID;

/** Identificadores de las entidades: UUID en texto (36 caracteres). */
public final class Ids {

    private Ids() {
    }

    public static String newId() {
        return UUID.randomUUID().toString();
    }
}
