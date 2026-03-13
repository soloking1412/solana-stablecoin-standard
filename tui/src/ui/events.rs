use ratatui::prelude::*;
use ratatui::widgets::*;
use crate::app::App;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let items: Vec<ListItem> = app
        .recent_events
        .iter()
        .skip(app.scroll_offset)
        .take(area.height as usize - 4)
        .map(|e| {
            let style = match e.event_type.as_str() {
                "Failed" => Style::default().fg(Color::Red),
                "Mint" => Style::default().fg(Color::Green),
                "Burn" => Style::default().fg(Color::Yellow),
                "Freeze" => Style::default().fg(Color::Cyan),
                "Seize" => Style::default().fg(Color::Magenta),
                _ => Style::default(),
            };

            ListItem::new(Line::from(vec![
                Span::styled(
                    format!("[{}] ", e.timestamp),
                    Style::default().fg(Color::DarkGray),
                ),
                Span::styled(
                    format!("{:<12} ", e.event_type),
                    style,
                ),
                Span::raw(format!("{} {}", e.actor, e.details)),
            ]))
        })
        .collect();

    let list = List::new(items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(format!(" Events ({}) ", app.recent_events.len())),
        );

    frame.render_widget(list, area);
}
