use ratatui::prelude::*;
use ratatui::widgets::*;
use crate::app::App;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let header = Row::new(vec!["Address", "Balance", "Status"])
        .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));

    let rows: Vec<Row> = app
        .holders
        .iter()
        .skip(app.scroll_offset)
        .take(area.height as usize - 4)
        .map(|h| {
            let status = if h.frozen { "Frozen" } else { "Active" };
            let status_style = if h.frozen {
                Style::default().fg(Color::Red)
            } else {
                Style::default().fg(Color::Green)
            };

            Row::new(vec![
                Cell::from(if h.address.len() > 20 {
                    format!("{}...{}", &h.address[..8], &h.address[h.address.len()-8..])
                } else {
                    h.address.clone()
                }),
                Cell::from(h.balance.to_string()),
                Cell::from(status).style(status_style),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Percentage(50),
            Constraint::Percentage(30),
            Constraint::Percentage(20),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title(format!(" Holders ({}) ", app.holders.len())),
    );

    frame.render_widget(table, area);
}
