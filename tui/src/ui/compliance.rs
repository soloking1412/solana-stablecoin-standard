use crate::app::App;
use ratatui::prelude::*;
use ratatui::widgets::*;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Length(5), Constraint::Min(0)])
        .split(area);

    // Compliance status
    let is_compliant = app.token_info.as_ref().is_some_and(|t| t.preset >= 2);
    let status_text = if is_compliant {
        vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Compliance Mode: SSS-2 (Full)",
                Style::default()
                    .fg(Color::Green)
                    .add_modifier(Modifier::BOLD),
            )),
            Line::from(format!("  Blacklisted Addresses: {}", app.blacklist.len())),
        ]
    } else {
        vec![
            Line::from(""),
            Line::from(Span::styled(
                "  Compliance Mode: SSS-1 (Basic)",
                Style::default().fg(Color::Yellow),
            )),
            Line::from("  Blacklist features not available on SSS-1 tokens."),
        ]
    };

    let status = Paragraph::new(status_text).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Compliance Status "),
    );
    frame.render_widget(status, chunks[0]);

    // Blacklist table
    let header = Row::new(vec!["Address", "Reason", "Added By", "Date"]).style(
        Style::default()
            .fg(Color::Yellow)
            .add_modifier(Modifier::BOLD),
    );

    let rows: Vec<Row> = app
        .blacklist
        .iter()
        .skip(app.scroll_offset)
        .map(|b| {
            Row::new(vec![
                Cell::from(if b.address.len() > 16 {
                    format!(
                        "{}...{}",
                        &b.address[..6],
                        &b.address[b.address.len() - 6..]
                    )
                } else {
                    b.address.clone()
                }),
                Cell::from(b.reason.clone()),
                Cell::from(if b.added_by.len() > 12 {
                    format!("{}...", &b.added_by[..12])
                } else {
                    b.added_by.clone()
                }),
                Cell::from(b.added_at.clone()),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(30),
            Constraint::Percentage(30),
            Constraint::Percentage(20),
            Constraint::Percentage(20),
        ],
    )
    .header(header)
    .block(Block::default().borders(Borders::ALL).title(" Blacklist "));

    frame.render_widget(table, chunks[1]);
}
