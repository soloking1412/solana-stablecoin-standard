use crate::app::App;
use ratatui::prelude::*;
use ratatui::widgets::*;

pub fn render(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(area);

    let left = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[0]);

    // Token info
    let info_text = if let Some(ref info) = app.token_info {
        vec![
            Line::from(format!("Name:      {}", info.name)),
            Line::from(format!("Symbol:    {}", info.symbol)),
            Line::from(format!("Preset:    SSS-{}", info.preset)),
            Line::from(format!("Decimals:  {}", info.decimals)),
            Line::from(format!("Authority: {}", &info.authority[..16])),
            Line::from(""),
            Line::from(format!(
                "Status:    {}",
                if info.paused { "PAUSED" } else { "Active" }
            )),
        ]
    } else {
        vec![Line::from("Loading...")]
    };

    let info_block = Paragraph::new(info_text)
        .block(Block::default().borders(Borders::ALL).title(" Token Info "));
    frame.render_widget(info_block, left[0]);

    // Supply stats
    let supply_text = if let Some(ref info) = app.token_info {
        vec![
            Line::from(format!("Total Minted:     {}", info.total_minted)),
            Line::from(format!("Total Burned:     {}", info.total_burned)),
            Line::from(format!("Circulating:      {}", app.circulating_supply())),
        ]
    } else {
        vec![Line::from("Loading...")]
    };

    let supply_block =
        Paragraph::new(supply_text).block(Block::default().borders(Borders::ALL).title(" Supply "));
    frame.render_widget(supply_block, left[1]);

    // Recent events
    let event_items: Vec<ListItem> = app
        .recent_events
        .iter()
        .take(15)
        .map(|e| ListItem::new(format!("[{}] {} - {}", e.timestamp, e.event_type, e.actor)))
        .collect();

    let events_list = List::new(event_items).block(
        Block::default()
            .borders(Borders::ALL)
            .title(" Recent Activity "),
    );
    frame.render_widget(events_list, chunks[1]);
}
