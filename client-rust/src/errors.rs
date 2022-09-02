use thiserror::Error;

pub type AmmanClientResult<T> = Result<T, AmmanClientError>;

#[derive(Error, Debug)]
pub enum AmmanClientError {
    #[error("reqwest failed to communicate with the relay")]
    RequestToRelayFailed(#[from] reqwest::Error),

    #[error("relay responded with with error: {0}")]
    RelayReplayHasError(String),

    #[error("relay responded with with neither result nor error")]
    RelayReplyHasNeitherResultNorError,
}
