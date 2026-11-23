/** Safari SpeechSynthesis pause/resume policy.
 * If WebKit discarded a paused utterance, resume() cannot restore it.
 * Restart from the last confirmed boundary instead of leaving a stuck button.
 */
export type SpeechEngineState={speaking:boolean;paused:boolean;pending:boolean};
export type PausedSpeechAction="resume"|"restart";
export function pausedSpeechAction(state:SpeechEngineState):PausedSpeechAction{
 return state.speaking?"resume":"restart";
}
