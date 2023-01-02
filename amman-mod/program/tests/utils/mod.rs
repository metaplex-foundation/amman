use amman_mod::amman_mod_id;
use solana_program_test::ProgramTest;
mod accounts;

pub use accounts::*;

pub fn program_test() -> ProgramTest {
    ProgramTest::new("amman_mod", amman_mod_id(), None)
}
