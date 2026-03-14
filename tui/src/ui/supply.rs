use crate::app::App;
use ratatui::prelude::*;
use ratatui::widgets::*;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(40), Constraint::Percentage(60)])
        .split(area);

    let supply_text = if let Some(ref info) = app.token_info {
        vec![
            Line::from(""),
            Line::from(format!("  Total Minted:        {}", info.total_minted)),
            Line::from(format!("  Total Burned:        {}", info.total_burned)),
            Line::from(format!(
                "  Circulating Supply:  {}",
                app.circulating_supply()
            )),
            Line::from(""),
            Line::from(format!(
                "  Burn Rate:           {:.2}%",
                if info.total_minted > 0 {
                    (info.total_burned as f64 / info.total_minted as f64) * 100.0
                } else {
                    0.0
                }
            )),
        ]
    } else {
        vec![Line::from("  Loading...")]
    };

    let supply_block = Paragraph::new(supply_text).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Supply Details "),
    );
    frame.render_widget(supply_block, chunks[0]);

    // Supply sparkline (mock data for visualization)
    let data: Vec<u64> = (0..50)
        .map(|i| app.circulating_supply().saturating_add(i * 100))
        .collect();

    let sparkline = Sparkline::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title(" Supply History "),
        )
        .data(&data)
        .style(Style::default().fg(Color::Green));
    frame.render_widget(sparkline, chunks[1]);
}
