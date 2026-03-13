use solana_sdk::pubkey::Pubkey;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tab {
    Dashboard,
    Supply,
    Holders,
    Events,
    Compliance,
}

impl Tab {
    pub fn title(&self) -> &str {
        match self {
            Tab::Dashboard => "Dashboard",
            Tab::Supply => "Supply",
            Tab::Holders => "Holders",
            Tab::Events => "Events",
            Tab::Compliance => "Compliance",
        }
    }

    pub fn all() -> &'static [Tab] {
        &[Tab::Dashboard, Tab::Supply, Tab::Holders, Tab::Events, Tab::Compliance]
    }
}

#[derive(Debug, Clone)]
pub struct TokenInfo {
    pub name: String,
    pub symbol: String,
    pub preset: u8,
    pub authority: String,
    pub paused: bool,
    pub total_minted: u64,
    pub total_burned: u64,
    pub decimals: u8,
}

#[derive(Debug, Clone)]
pub struct HolderInfo {
    pub address: String,
    pub balance: u64,
    pub frozen: bool,
}

#[derive(Debug, Clone)]
pub struct EventEntry {
    pub event_type: String,
    pub actor: String,
    pub details: String,
    pub timestamp: String,
}

#[derive(Debug, Clone)]
pub struct BlacklistInfo {
    pub address: String,
    pub reason: String,
    pub added_by: String,
    pub added_at: String,
}

pub struct App {
    pub current_tab: Tab,
    pub token_info: Option<TokenInfo>,
    pub holders: Vec<HolderInfo>,
    pub recent_events: Vec<EventEntry>,
    pub blacklist: Vec<BlacklistInfo>,
    pub is_loading: bool,
    pub tick_count: u64,
    pub should_quit: bool,
    pub scroll_offset: usize,
    pub rpc_url: String,
    pub mint_address: String,
}

impl App {
    pub fn new(rpc_url: String, mint_address: String) -> Self {
        Self {
            current_tab: Tab::Dashboard,
            token_info: None,
            holders: Vec::new(),
            recent_events: Vec::new(),
            blacklist: Vec::new(),
            is_loading: true,
            tick_count: 0,
            should_quit: false,
            scroll_offset: 0,
            rpc_url,
            mint_address,
        }
    }

    pub fn tick(&mut self) {
        self.tick_count += 1;
    }

    pub fn next_tab(&mut self) {
        let tabs = Tab::all();
        let idx = tabs.iter().position(|t| *t == self.current_tab).unwrap_or(0);
        self.current_tab = tabs[(idx + 1) % tabs.len()];
        self.scroll_offset = 0;
    }

    pub fn prev_tab(&mut self) {
        let tabs = Tab::all();
        let idx = tabs.iter().position(|t| *t == self.current_tab).unwrap_or(0);
        self.current_tab = if idx == 0 { tabs[tabs.len() - 1] } else { tabs[idx - 1] };
        self.scroll_offset = 0;
    }

    pub fn scroll_down(&mut self) {
        self.scroll_offset = self.scroll_offset.saturating_add(1);
    }

    pub fn scroll_up(&mut self) {
        self.scroll_offset = self.scroll_offset.saturating_sub(1);
    }

    pub fn circulating_supply(&self) -> u64 {
        self.token_info.as_ref().map_or(0, |t| {
            t.total_minted.saturating_sub(t.total_burned)
        })
    }
}
