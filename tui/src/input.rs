use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers};
use crate::app::App;

pub fn handle_key_event(app: &mut App, key: KeyEvent) {
    match key.code {
        KeyCode::Char('q') | KeyCode::Esc => app.should_quit = true,
        KeyCode::Char('c') if key.modifiers.contains(KeyModifiers::CONTROL) => {
            app.should_quit = true;
        }
        KeyCode::Tab | KeyCode::Right => app.next_tab(),
        KeyCode::BackTab | KeyCode::Left => app.prev_tab(),
        KeyCode::Char('1') => app.current_tab = crate::app::Tab::Dashboard,
        KeyCode::Char('2') => app.current_tab = crate::app::Tab::Supply,
        KeyCode::Char('3') => app.current_tab = crate::app::Tab::Holders,
        KeyCode::Char('4') => app.current_tab = crate::app::Tab::Events,
        KeyCode::Char('5') => app.current_tab = crate::app::Tab::Compliance,
        KeyCode::Down | KeyCode::Char('j') => app.scroll_down(),
        KeyCode::Up | KeyCode::Char('k') => app.scroll_up(),
        KeyCode::Char('r') => app.is_loading = true,
        _ => {}
    }
}
