pub mod dashboard;
pub mod supply;
pub mod holders;
pub mod events;
pub mod compliance;

use ratatui::prelude::*;
use ratatui::widgets::*;
use crate::app::{App, Tab};

pub fn render(frame: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // tabs
            Constraint::Min(0),   // content
            Constraint::Length(1), // status bar
        ])
        .split(frame.area());

    render_tabs(frame, app, chunks[0]);

    match app.current_tab {
        Tab::Dashboard => dashboard::render(frame, app, chunks[1]),
        Tab::Supply => supply::render(frame, app, chunks[1]),
        Tab::Holders => holders::render(frame, app, chunks[1]),
        Tab::Events => events::render(frame, app, chunks[1]),
        Tab::Compliance => compliance::render(frame, app, chunks[1]),
    }

    render_status_bar(frame, app, chunks[2]);
}

fn render_tabs(frame: &mut Frame, app: &App, area: Rect) {
    let titles: Vec<Line> = Tab::all()
        .iter()
        .map(|t| {
            let style = if *t == app.current_tab {
                Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Gray)
            };
            Line::from(t.title()).style(style)
        })
        .collect();

    let tabs = Tabs::new(titles)
        .block(Block::default().borders(Borders::ALL).title(" SSS Token Manager "))
        .highlight_style(Style::default().fg(Color::Yellow))
        .divider(" | ");

    frame.render_widget(tabs, area);
}

fn render_status_bar(frame: &mut Frame, app: &App, area: Rect) {
    let status = if app.is_loading {
        " Loading... | Press 'r' to refresh | 'q' to quit"
    } else {
        " Tab/←→: switch | ↑↓/jk: scroll | r: refresh | q: quit"
    };

    let bar = Paragraph::new(status).style(Style::default().fg(Color::DarkGray));
    frame.render_widget(bar, area);
}
