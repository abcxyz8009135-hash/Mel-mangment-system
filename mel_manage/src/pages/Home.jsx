import SessionForm from '../components/SessionForm'
import { useAuth } from '../auth/AuthContext'
import { submitSession } from '../functions/sessionsApi'
import { SESSIONS, EMPTY_VALUES, todayString, nowTimeString } from '../functions/sessionOptions'

function Home({ onSubmitted }) {
  const { profile } = useAuth()

  const handleSubmit = async (values) => {
    const saved = await submitSession(values)
    onSubmitted?.()
    if (saved.approvalStatus === 'approved') {
      return { type: 'success', text: `${saved.session} for ${saved.date} saved to history.` }
    }
    return {
      type: 'warning',
      text: `${saved.session} for ${saved.date} is ${saved.result.adjustedStatus ?? saved.result.status}. It was sent to the admin for approval and will appear in history once approved.`,
    }
  }

  return (
    <SessionForm
      initial={{ date: todayString(), time: nowTimeString(), session: SESSIONS[0], simId: '', start: EMPTY_VALUES, end: EMPTY_VALUES, complaints: [] }}
      prefillStart
      submitLabel="Submit"
      onSubmit={handleSubmit}
      intro={<>Submitting as <strong>{profile.full_name}</strong></>}
    />
  )
}

export default Home
