const FIELDS = [
  { key: 'tele', label: 'Tele Birr Balance', placeholder: 'telebirr ...' },
  { key: 'reddy', label: 'Reddy Balance', placeholder: 'reddy ...' },
  { key: 'deposit', label: 'Deposit', placeholder: 'deposit ...' },
  { key: 'withdrawal', label: 'Withdrawal', placeholder: 'withdrawal ...' },
]

function Form({ title, prefix, values, onChange }) {
  return (
    <div className="card form-card">
      <h2>{title}</h2>
      {FIELDS.map(({ key, label, placeholder }) => (
        <div className="field" key={key}>
          <label htmlFor={`${prefix}-${key}`}>{label}</label>
          <input
            type="number"
            inputMode="decimal"
            id={`${prefix}-${key}`}
            placeholder={placeholder}
            value={values[key]}
            onChange={(e) => onChange(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}

export default Form
