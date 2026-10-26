package com.amigoinvisible.draw;

/** El sorteo no se puede hacer (poca gente o exclusiones imposibles). El mensaje es para la persona. */
public class DrawException extends RuntimeException {

    public DrawException(String message) {
        super(message);
    }
}
