mod app;
mod input;
mod rpc;
mod ui;

use std::io;
use std::time::Duration;
use anyhow::Result;
use clap::Parser;
use crossterm::{
    event::{self, Event},
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
    ExecutableCommand,
};
use ratatui::prelude::*;

use app::App;

#[derive(Parser)]
#[command(name = "sss-tui", about = "Solana Stablecoin Standard TUI Dashboard")]
struct Args {
    /// Solana RPC URL
    #[arg(short, long, default_value = "https://api.devnet.solana.com")]
    rpc_url: String,

    /// Token mint address
    #[arg(short, long)]
    mint: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let mut app = App::new(args.rpc_url.clone(), args.mint.clone());

    // Setup terminal
    enable_raw_mode()?;
    io::stdout().execute(EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(io::stdout());
    let mut terminal = Terminal::new(backend)?;

    // Initial data fetch
    let client = solana_client::rpc_client::RpcClient::new(&args.rpc_url);
    match rpc::fetch_config(&client, &args.mint) {
        Ok(info) => {
            app.token_info = Some(info);
            app.is_loading = false;
        }
        Err(e) => {
            app.token_info = Some(app::TokenInfo {
                name: format!("Error: {}", e),
                symbol: "ERR".into(),
                preset: 0,
                authority: "unknown".into(),
                paused: false,
                total_minted: 0,
                total_burned: 0,
                decimals: 6,
            });
            app.is_loading = false;
        }
    }

    if let Ok(holders) = rpc::fetch_holders(&client, &args.mint) {
        app.holders = holders;
    }
    if let Ok(events) = rpc::fetch_recent_events(
        &client,
        "StbMVdQRUykc9jS3bT1LCiHBqBos1awkVHFn2cFRLwR",
    ) {
        app.recent_events = events;
    }

    // Main loop
    loop {
        terminal.draw(|frame| ui::render(frame, &app))?;

        if event::poll(Duration::from_millis(250))? {
            if let Event::Key(key) = event::read()? {
                input::handle_key_event(&mut app, key);
            }
        }

        if app.should_quit {
            break;
        }

        // Periodic refresh
        if app.is_loading {
            if let Ok(info) = rpc::fetch_config(&client, &args.mint) {
                app.token_info = Some(info);
            }
            if let Ok(holders) = rpc::fetch_holders(&client, &args.mint) {
                app.holders = holders;
            }
            app.is_loading = false;
        }

        app.tick();
    }

    // Restore terminal
    disable_raw_mode()?;
    io::stdout().execute(LeaveAlternateScreen)?;

    Ok(())
}
