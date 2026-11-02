// A boxed line. The border carries the meaning (a heavy white rule for a problem, a
// hairline for a calm heads up) and the words stay white on ink so they always read.
// `live` makes a screen reader speak it when it appears.
const Note = ({ tone = 'calm', live = false, children, ...rest }) => (
  <div
    className={`qf-note qf-note--${tone}`}
    role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}
    {...rest}
  >
    {children}
  </div>
);

export default Note;
