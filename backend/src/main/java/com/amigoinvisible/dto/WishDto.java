package com.amigoinvisible.dto;

/** Un deseo. En las peticiones, los deseos nuevos llegan con id vacío. url puede ser null. */
public record WishDto(String id, String text, String url) {
}
