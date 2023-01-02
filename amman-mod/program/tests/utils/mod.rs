use amman_mod::amman_mod_id;
use solana_program_test::ProgramTest;

pub fn program_test() -> ProgramTest {
    ProgramTest::new("amman_mod", amman_mod_id(), None)
}
