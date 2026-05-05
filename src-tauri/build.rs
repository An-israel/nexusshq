fn main() {
    // Bake NEXUS_APP_URL into the binary at compile time.
    // Set this env var when running `cargo tauri build` to point at your deployment.
    let url = std::env::var("NEXUS_APP_URL")
        .unwrap_or_else(|_| "https://nexushq.lovable.app".to_string());
    println!("cargo:rustc-env=NEXUS_APP_URL={url}");
    println!("cargo:rerun-if-env-changed=NEXUS_APP_URL");

    tauri_build::build();
}
