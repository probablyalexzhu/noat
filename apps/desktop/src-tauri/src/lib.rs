// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Global shortcut: Option+/ (macOS) or Alt+/ (Windows/Linux) toggles main window visibility.
    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcut("Alt+/")
        .expect("invalid shortcut Alt+/")
        .with_handler(|app, _shortcut, event| {
            use tauri::Manager;
            use tauri_plugin_global_shortcut::ShortcutState;
            if event.state == ShortcutState::Pressed {
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(shortcut_plugin)
        .plugin(tauri_plugin_opener::init())
        // macOS: hide from dock and set up global mouse monitor for hover
        // detection on unfocused windows (the WKWebView only receives mouse
        // events when the window is key — see tauri-apps/tauri#11386).
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use std::ptr::NonNull;
                use std::sync::atomic::{AtomicBool, Ordering};
                use std::sync::Arc;

                use block2::RcBlock;
                use objc2_app_kit::{NSEvent, NSEventMask, NSWindow};
                use objc2_foundation::NSRect;
                use tauri::Emitter;
                use tauri::Manager;

                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                let window = app.get_webview_window("main").unwrap();
                let ns_window_ptr = window.ns_window().unwrap() as *mut NSWindow;

                let inside = Arc::new(AtomicBool::new(false));
                let inside_clone = inside.clone();
                let app_handle = app.handle().clone();

                // Global mouse monitor: fires when the app is NOT focused.
                // Tracks cursor entering/leaving the window frame and emits
                // Tauri events so the frontend can show/hide controls.
                let block = RcBlock::new(move |_event: NonNull<NSEvent>| {
                    let mouse_loc = NSEvent::mouseLocation();
                    let frame: NSRect = unsafe { (*ns_window_ptr).frame() };

                    let is_inside = mouse_loc.x >= frame.origin.x
                        && mouse_loc.x <= frame.origin.x + frame.size.width
                        && mouse_loc.y >= frame.origin.y
                        && mouse_loc.y <= frame.origin.y + frame.size.height;

                    let was_inside = inside_clone.swap(is_inside, Ordering::Relaxed);

                    if is_inside && !was_inside {
                        let _ = app_handle.emit("mouse-entered-window", ());
                    } else if !is_inside && was_inside {
                        let _ = app_handle.emit("mouse-left-window", ());
                    }
                });

                let _monitor = NSEvent::addGlobalMonitorForEventsMatchingMask_handler(
                    NSEventMask::MouseMoved,
                    &block,
                );

                // Keep the monitor and block alive for the lifetime of the app.
                std::mem::forget(block);
                std::mem::forget(_monitor);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
