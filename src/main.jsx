import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, Crown, Image, Link2, LocateFixed, LogOut, MapPin, MessageCircle, PanelRightClose, Plus, Search, Send, Trash2, UserMinus, Users, X } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase'
import './style.css'

const TAGS = ['관광', '식당', '숙소', '카페', '기타']
const MAX_NAME_LENGTH = 10
const MIN_LOADING_MS = 700
const AUTH_STORAGE_KEY = 'trip_auth_user'
const ROOM_SESSION_STORAGE_KEY = 'trip_room_session'
const SEARCH_STORAGE_KEY = 'trip_recent_searches'
const PLACE_ORDER_STORAGE_KEY = 'trip_place_order'
const ROUTE_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#5856d6', '#af52de', '#ff2d55']
const MESSAGE_REACTIONS = ['❤️', '👍', '😂']
const POPULAR_TRAVEL_PLACES = [
  { name: '해운대해수욕장', area: '부산 해운대구' },
  { name: '감천문화마을', area: '부산 사하구' },
  { name: '경복궁', area: '서울 종로구' },
  { name: '성산일출봉', area: '제주 서귀포시' },
  { name: '전주한옥마을', area: '전북 전주시' },
  { name: '강릉 안목해변', area: '강원 강릉시' }
]
const BLOCKED_WORDS = ['시발', '씨발', '병신', '좆', '개새끼', 'fuck', 'shit']

function safeParseJson(value) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function hasBlockedWord(value) {
  const normalized = value.toLowerCase().replace(/\s/g, '')
  return BLOCKED_WORDS.some(word => normalized.includes(word))
}

async function withMinimumLoading(work) {
  const [result] = await Promise.all([work(), sleep(MIN_LOADING_MS)])
  return result
}

function validateDisplayName(value, label) {
  const trimmed = value.trim()
  if (!trimmed) return `${label}을 입력해주세요.`
  if (trimmed.length > MAX_NAME_LENGTH) return `${label}은 10자 이하로 입력해주세요.`
  if (hasBlockedWord(trimmed)) return `${label}에 사용할 수 없는 표현이 있습니다.`
  return ''
}

function getProviderLabel(provider) {
  if (provider === 'kakao') return '카카오'
  if (provider === 'google') return '구글'
  if (provider === 'guest') return '게스트'
  return '로그인'
}

function normalizeDisplayName(value, fallback) {
  const compact = String(value || '').trim()
  return (compact || fallback).slice(0, MAX_NAME_LENGTH)
}

function getRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length]
}

function LogoMark({ className = '' }) {
  return <img className={className ? `brandLogo ${className}` : 'brandLogo'} src="/wherego-logo.png" alt="" aria-hidden="true" />
}

function buildMapSearchUrl(provider, place) {
  const query = encodeURIComponent(`${place?.name || ''} ${place?.address || ''}`.trim())
  if (provider === 'naver') return `https://map.naver.com/p/search/${query}`
  return `https://map.kakao.com/link/search/${query}`
}

function buildOAuthUser(authSession) {
  const user = authSession?.user
  if (!user) return null
  const metadata = user.user_metadata || {}
  const provider = user.app_metadata?.provider || metadata.provider || 'google'
  const emailName = user.email?.split('@')[0]
  return {
    id: user.id,
    provider,
    displayName: normalizeDisplayName(metadata.full_name || metadata.name || metadata.nickname || metadata.user_name || emailName, `${getProviderLabel(provider)} 사용자`),
    isGuest: false
  }
}

function loadKakaoMap() {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) return resolve(window.kakao)
    const key = import.meta.env.VITE_KAKAO_MAP_KEY
    if (!key) return reject(new Error('VITE_KAKAO_MAP_KEY가 없습니다.'))
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false`
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = reject
    document.head.appendChild(script)
  })
}

function App() {
  const savedSession = safeParseJson(localStorage.getItem(ROOM_SESSION_STORAGE_KEY))
  const savedAuthUser = safeParseJson(localStorage.getItem(AUTH_STORAGE_KEY))
  const [authUser, setAuthUser] = useState(savedAuthUser)
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState(savedSession)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const showLanding = window.location.pathname === '/landing' || new URLSearchParams(window.location.search).get('landing') === '1'
  const [landingOpen, setLandingOpen] = useState(() => showLanding && sessionStorage.getItem('trip_room_landing_seen') !== 'true')

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false)
      return
    }

    let mounted = true

    async function loadAuthUser() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      const oauthUser = buildOAuthUser(data?.session)
      const storedUser = safeParseJson(localStorage.getItem(AUTH_STORAGE_KEY))
      const nextUser = oauthUser || storedUser

      if (nextUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser))
      } else {
        setSession(prev => prev)
      }

      setAuthUser(nextUser)
      setAuthLoading(false)
    }

    loadAuthUser()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const nextUser = buildOAuthUser(nextSession)
      if (!nextUser) {
        const storedUser = safeParseJson(localStorage.getItem(AUTH_STORAGE_KEY))
        if (storedUser?.isGuest) return
        if (event !== 'SIGNED_OUT') return
        localStorage.removeItem(AUTH_STORAGE_KEY)
        localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
        setAuthUser(null)
        setSession(null)
        return
      }

      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser))
      setAuthUser(nextUser)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authUser || !session?.authId || session.authId === authUser.id) return
    localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    setSession(null)
  }, [authUser, session?.authId])

  function startService() {
    sessionStorage.setItem('trip_room_landing_seen', 'true')
    setLandingOpen(false)
  }

  async function handleOAuthLogin(provider) {
    localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    setSession(null)
    const options = { redirectTo: window.location.origin }
    if (provider === 'kakao') {
      options.scopes = 'profile_nickname,profile_image'
      options.queryParams = { scope: 'profile_nickname,profile_image' }
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options
    })
    if (error) throw error
  }

  function handleGuestLogin(username) {
    const nextUser = {
      id: `guest-${Date.now()}`,
      provider: 'guest',
      displayName: username,
      isGuest: true
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser))
    localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    setAuthUser(nextUser)
    setSession(null)
    setAuthModalOpen(false)
  }

  async function handleLogout() {
    if (authUser && !authUser.isGuest) {
      await supabase.auth.signOut()
    }
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    setAuthUser(null)
    setSession(null)
  }

  if (!isSupabaseConfigured) return <SetupRequired />
  if (authLoading) return <div className="lobby authLobby"><div className="loadingOverlay inlineLoading"><div className="spinner" /><b>로그인 확인 중...</b></div></div>
  if (landingOpen) return <Landing onStart={startService} />
  return session
    ? <Room session={session} setSession={setSession} authUser={authUser} onLogout={handleLogout} onOAuthLogin={handleOAuthLogin} />
    : <>
      <Lobby setSession={setSession} authUser={authUser} onLogout={handleLogout} onRequireAuth={() => setAuthModalOpen(true)} />
      {authModalOpen && <AuthScreen modal onClose={() => setAuthModalOpen(false)} onOAuthLogin={handleOAuthLogin} onGuestLogin={handleGuestLogin} />}
    </>
}

function SetupRequired() {
  return <div className="lobby authLobby">
    <div className="card setupCard">
      <div className="appMark"><LogoMark /></div>
      <h1>설정이 필요해요</h1>
      <p>Supabase 환경변수가 없어서 앱을 시작하지 못했어요. 프로젝트 루트에 <b>.env</b> 파일을 만들고 아래 값을 채워주세요.</p>
      <pre>{`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_KAKAO_MAP_KEY=your_kakao_javascript_key`}</pre>
      <div className="setupHint">저장한 뒤 dev server를 다시 실행하면 로그인 화면이 나옵니다.</div>
    </div>
  </div>
}

function AuthScreen({ modal = false, onClose, onOAuthLogin, onGuestLogin }) {
  const [error, setError] = useState('')
  const [loadingProvider, setLoadingProvider] = useState('')
  const isLoading = Boolean(loadingProvider)

  async function loginWithProvider(provider) {
    setError('')
    setLoadingProvider(provider)
    try {
      await onOAuthLogin(provider)
    } catch (error) {
      setError(error.message || '로그인을 시작하지 못했어요.')
      setLoadingProvider('')
    }
  }

  const content = <div className="card authCard">
      {modal && <button className="iconButton authCloseButton" onClick={onClose} title="닫기"><X size={20} /></button>}
      <div className="appMark"><LogoMark /></div>
      <h1>어디가</h1>
      <p>로그인하고 나만의 여행 방을 직접 만들어 보세요.</p>
      <div className="authActions">
        <button className="oauthButton kakao" disabled={isLoading} onClick={() => loginWithProvider('kakao')}>
          <span className="socialLogo kakaoLogo"><KakaoLogo /></span>
          <span>{loadingProvider === 'kakao' ? '카카오 연결 중...' : '카카오계정 로그인'}</span>
        </button>
        <button className="oauthButton google" disabled={isLoading} onClick={() => loginWithProvider('google')}>
          <span className="socialLogo googleLogo"><GoogleLogo /></span>
          <span>{loadingProvider === 'google' ? '구글 연결 중...' : 'Google로 시작하기'}</span>
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </div>

  if (modal) {
    return <div className="modalBackdrop authBackdrop" onMouseDown={event => event.target === event.currentTarget && onClose?.()}>
      {content}
    </div>
  }

  return <div className="lobby authLobby">{content}</div>
}

function KakaoLogo() {
  return <svg viewBox="0 0 40 40" aria-hidden="true">
    <path fill="currentColor" d="M20 8c-7.18 0-13 4.48-13 10 0 3.46 2.29 6.51 5.77 8.3l-1.05 4.18c-.12.49.43.87.84.58l4.85-3.42c.84.14 1.71.21 2.59.21 7.18 0 13-4.48 13-10S27.18 8 20 8Z" />
  </svg>
}

function GoogleLogo() {
  return <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.72 1.22 9.22 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.14-3.08-.4-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.01l7.73 6c4.51-4.18 7.09-10.36 7.09-17.48Z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.77 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.86.92 7.5 2.56 10.78l7.97-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.97l-7.73-6c-2.15 1.45-4.9 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.74l-7.97 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>
}

function Landing({ onStart }) {
  const heroMapRef = useRef(null)

  useEffect(() => {
    loadKakaoMap().then(kakao => {
      if (!heroMapRef.current) return
      const map = new kakao.maps.Map(heroMapRef.current, {
        center: new kakao.maps.LatLng(35.1595, 129.1604),
        level: 5
      })
      map.setDraggable(false)
      map.setZoomable(false)
      new kakao.maps.Marker({
        position: new kakao.maps.LatLng(35.1587, 129.1603),
        map
      })
    }).catch(() => {})
  }, [])

  return <main className="landing">
    <div ref={heroMapRef} className="landingMap" aria-hidden="true" />
    <nav className="landingNav">
      <div className="landingBrand">
        <span><LogoMark /></span>
        <b>어디가</b>
      </div>
      <div className="landingLinks">
        <a href="#flow">작동 방식</a>
        <a href="#features">기능</a>
        <button onClick={onStart}>시작하기</button>
      </div>
    </nav>

    <section className="landingHero">
      <div className="heroCopy">
        <div className="heroBadge">
          <MapPin size={16} />
          <span>어디가 · 여행 지도 방</span>
        </div>
        <h1>여행 장소를<br />같이 모으세요.</h1>
        <p>친구와 함께 만들고 공유하는 실시간 여행 계획 서비스입니다.</p>
        <div className="heroActions">
          <button className="heroPrimary" onClick={onStart}>시작하기</button>
          <a href="#flow">작동 방식 보기</a>
        </div>
      </div>

      <div className="heroVisual" aria-hidden="true">
        <div className="mapOrb">
          <span className="mapOrbPin"><LogoMark /></span>
          <b>부평깡통시장</b>
          <small>#관광 · 수성이 추가</small>
        </div>
        <div className="floatingChat">
          <MessageCircle size={20} />
          <span>지금 여기 어때?</span>
        </div>
      </div>
    </section>

    <section id="flow" className="landingSection">
      <div>
        <span className="sectionEyebrow">FLOW</span>
        <h2>방 만들고, 찍고, 공유하면 끝.</h2>
        <p>설명보다 빠르게 도착하는 작은 여행 지도. 세 단계면 친구들과 같은 지도를 볼 수 있어요.</p>
      </div>
      <div className="flowCards">
        <article>
          <span>01</span>
          <b>방 만들기</b>
          <p>여행 이름과 비밀번호로 친구들만 들어오는 방을 만듭니다.</p>
        </article>
        <article>
          <span>02</span>
          <b>장소 추가</b>
          <p>검색한 장소를 카테고리와 메모로 지도에 바로 저장합니다.</p>
        </article>
        <article>
          <span>03</span>
          <b>실시간 공유</b>
          <p>추가된 장소와 채팅이 같은 방 사람들에게 바로 보입니다.</p>
        </article>
      </div>
    </section>

    <section id="features" className="landingSection featureStrip">
      <div>
        <span className="sectionEyebrow">FEATURES</span>
        <h2>지도와 채팅이 한 화면에.</h2>
      </div>
      <div className="featureList">
        <span><MapPin size={18} />카카오 지도 검색</span>
        <span><Users size={18} />함께 있는 사람 관리</span>
        <span><MessageCircle size={18} />실시간 채팅 알림</span>
      </div>
    </section>
  </main>
}

function Lobby({ setSession, authUser, onLogout, onRequireAuth }) {
  const isGuest = authUser?.isGuest
  const [mode, setMode] = useState('find')
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState({ roomName: '', password: '', username: authUser?.displayName || '' })
  const [roomQuery, setRoomQuery] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [inviteRoom, setInviteRoom] = useState(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const lobbyMapRef = useRef(null)

  useEffect(() => {
    fetchRooms()
    fetchInviteRoom()
  }, [])

  useEffect(() => {
    setForm(prev => prev.username ? prev : { ...prev, username: authUser?.displayName || '' })
  }, [authUser?.displayName])

  useEffect(() => {
    if (isGuest && mode === 'create') {
      setMode('find')
      setError('게스트는 방 만들기를 할 수 없어요. 방 찾기로 참여해주세요.')
    }
  }, [isGuest, mode])

  useEffect(() => {
    loadKakaoMap().then(kakao => {
      if (!lobbyMapRef.current) return
      const map = new kakao.maps.Map(lobbyMapRef.current, {
        center: new kakao.maps.LatLng(35.1796, 129.0756),
        level: 8
      })
      map.setDraggable(false)
      map.setZoomable(false)
    }).catch(() => {})
  }, [])

  async function fetchRooms() {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: false })
    setRooms(data || [])
  }

  async function fetchInviteRoom() {
    const roomId = new URLSearchParams(window.location.search).get('room')
    if (!roomId) return
    setInviteLoading(true)
    const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    if (data && !error) {
      setInviteRoom(data)
      setRoomQuery(data.name)
      setSelectedRoom(data)
    } else {
      setError('초대받은 방을 찾지 못했어요.')
    }
    setInviteLoading(false)
  }

  function closeInviteRoom() {
    const nextUrl = `${window.location.origin}${window.location.pathname}`
    window.history.replaceState({}, '', nextUrl)
    setInviteRoom(null)
    setSelectedRoom(null)
    setRoomQuery('')
    setError('')
  }

  async function enterRoom(room) {
    setError('')
    if (!form.username.trim() || !form.password.trim()) return setError('이름과 비밀번호를 입력해주세요.')
    const usernameError = validateDisplayName(form.username, '사용자 이름')
    if (usernameError) return setError(usernameError)
    if (room.password !== form.password) return setError('방 비밀번호가 달라요.')
    setLoading(true)
    try {
      await withMinimumLoading(() => supabase.from('room_members').upsert({ room_id: room.id, username: form.username.trim() }, { onConflict: 'room_id,username' }))
      const next = {
        roomId: room.id,
        roomName: room.name,
        username: form.username.trim(),
        authId: authUser?.id || null,
        provider: authUser?.provider || 'guest',
        isGuest: !authUser || isGuest
      }
      localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(next))
      setSession(next)
    } catch (error) {
      setError(error.message || '입장 중 문제가 발생했습니다.')
      setLoading(false)
    }
  }

  async function createRoom() {
    setError('')
    if (!authUser) {
      onRequireAuth()
      return
    }
    if (isGuest) return setError('게스트는 방 만들기를 할 수 없어요. 방 찾기로 참여해주세요.')
    if (!form.roomName.trim() || !form.password.trim() || !form.username.trim()) return setError('방 이름, 비밀번호, 사용자 이름을 모두 입력해주세요.')
    const roomNameError = validateDisplayName(form.roomName, '방 이름')
    const usernameError = validateDisplayName(form.username, '사용자 이름')
    if (roomNameError || usernameError) return setError(roomNameError || usernameError)
    setLoading(true)
    const { data, error } = await withMinimumLoading(() => supabase.from('rooms').insert({ name: form.roomName.trim(), password: form.password, owner: form.username.trim() }).select().single())
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    await enterRoom(data)
  }

  function submitLobby() {
    if (mode === 'create') {
      createRoom()
      return
    }

    setError('')
    const query = roomQuery.trim()
    if (!query) return setError('입장할 방 이름을 입력해주세요.')
    if (filteredRooms.length === 0) return setError('검색된 방이 없어요.')
    if (!selectedRoom) return setError('입장할 방을 목록에서 선택해주세요.')
    enterRoom(selectedRoom)
  }

  const filteredRooms = rooms
    .filter(room => room.name.toLowerCase().includes(roomQuery.trim().toLowerCase()))
    .slice(0, 5)
  const primaryDisabled = loading || (mode === 'create' && Boolean(isGuest))

  if (inviteLoading || inviteRoom) {
    return <div className="lobby inviteLobby">
      <div ref={lobbyMapRef} className="lobbyMap" aria-hidden="true" />
      <div className="card inviteCard">
        <div className="cardTop">
          <div className="appMark"><LogoMark /></div>
          {authUser ? <div className="sessionPill">
            <span>{authUser.displayName.slice(0, 1)}</span>
            <div>
              <b>{authUser.displayName}</b>
              <small>{getProviderLabel(authUser.provider)} 로그인</small>
            </div>
          </div> : <button className="loginButton" onClick={onRequireAuth}>Log In</button>}
        </div>
        {inviteLoading
          ? <div className="inviteLoading"><div className="spinner" /><b>초대받은 방을 확인 중...</b></div>
          : <>
            <h1>{inviteRoom.name}</h1>
            <p>{inviteRoom.name} 방에 입장할까요?</p>
            <div className="formStack inviteForm">
              <label><span>닉네임</span><input maxLength={MAX_NAME_LENGTH} placeholder="사용자 이름" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
              <label><span>비밀번호</span><input placeholder="방 비밀번호" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
            </div>
            {error && <div className="error">{error}</div>}
            <div className="inviteActions">
              <button className="primary" disabled={loading} onClick={() => enterRoom(inviteRoom)}>{loading ? '입장 중...' : '입장하기'}</button>
              <button className="inviteSecondary" onClick={closeInviteRoom}>다른 방 찾기</button>
            </div>
          </>}
      </div>
    </div>
  }

  return <div className="lobby">
    <div ref={lobbyMapRef} className="lobbyMap" aria-hidden="true" />
    <div className="card">
      <div className="cardTop">
        <div className="appMark"><LogoMark /></div>
        {authUser ? <>
          <div className="sessionPill">
            <span>{authUser.displayName.slice(0, 1)}</span>
            <div>
              <b>{authUser.displayName}</b>
              <small>{getProviderLabel(authUser.provider)} 로그인</small>
            </div>
          </div>
          <button className="iconButton logoutButton" onClick={onLogout} title="로그아웃"><LogOut size={19} /></button>
        </> : <button className="loginButton" onClick={onRequireAuth}>Log In</button>}
      </div>
      <h1>어디가</h1>
      <p>친구와 함께 만들고 공유하는 실시간 여행 계획 서비스</p>
      <div className="tabs" role="tablist">
        <button className={mode === 'find' ? 'active' : ''} onClick={() => { setMode('find'); setError('') }}>방 찾기</button>
        <button className={mode === 'create' ? 'active' : ''} disabled={isGuest} onClick={() => { setMode('create'); setError('') }}>방 만들기</button>
      </div>
      {isGuest && <div className="guestNotice">게스트는 방 참가만 가능해요.</div>}
      <div className="formStack">
        {mode === 'create' && <label><span>방 이름</span><input maxLength={MAX_NAME_LENGTH} placeholder="예: 부산 어디가" value={form.roomName} onChange={e => setForm({ ...form, roomName: e.target.value })} /></label>}
        {mode === 'find' && <div className="roomSearchBlock">
          <label><span>방 검색</span><input placeholder="방 이름 입력" value={roomQuery} onChange={e => { setRoomQuery(e.target.value); setSelectedRoom(null) }} /></label>
          {roomQuery.trim() && <div className="roomSuggestions">
            {filteredRooms.map(room => (
              <button key={room.id} className={selectedRoom?.id === room.id ? 'active' : ''} onClick={() => { setSelectedRoom(room); setRoomQuery(room.name) }}>
                <span>{room.name.slice(0, 1)}</span>
                <b>{room.name}</b>
              </button>
            ))}
            {filteredRooms.length === 0 && <p>검색된 방이 없어요.</p>}
          </div>}
        </div>}
        <label><span>사용자 이름</span><input maxLength={MAX_NAME_LENGTH} placeholder="수성" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></label>
        <label><span>방 비밀번호</span><input placeholder="비밀번호" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
      </div>
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={primaryDisabled} onClick={submitLobby}>{loading ? '준비 중...' : mode === 'create' ? '방 만들고 입장' : '입장하기'}</button>
    </div>
    {loading && <div className="loadingOverlay"><div className="spinner" /><b>{mode === 'create' ? '방을 만들고 있어요' : '방에 입장하고 있어요'}</b></div>}
  </div>
}

function Room({ session, setSession, authUser, onLogout, onOAuthLogin }) {
  const isGuest = authUser ? authUser.isGuest : session.isGuest
  const profileName = authUser?.displayName || session.username
  const profileProvider = authUser?.provider || session.provider || 'guest'
  const [messages, setMessages] = useState([])
  const [messageReactions, setMessageReactions] = useState([])
  const [members, setMembers] = useState([])
  const [places, setPlaces] = useState([])
  const [placeComments, setPlaceComments] = useState([])
  const [roomInfo, setRoomInfo] = useState({ owner: '' })
  const [joinedRooms, setJoinedRooms] = useState([])
  const [chatOpen, setChatOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [membersOpen, setMembersOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [chatWidth, setChatWidth] = useState(380)
  const [roomManagerOpen, setRoomManagerOpen] = useState(false)
  const [roomMode, setRoomMode] = useState('find')
  const [allRooms, setAllRooms] = useState([])
  const [roomQuery, setRoomQuery] = useState('')
  const [selectedJoinRoom, setSelectedJoinRoom] = useState(null)
  const [roomForm, setRoomForm] = useState({ roomName: '', password: '' })
  const [roomError, setRoomError] = useState('')
  const [roomLoading, setRoomLoading] = useState(false)
  const [roomAuthLoadingProvider, setRoomAuthLoadingProvider] = useState('')
  const [mobileView, setMobileView] = useState('map')
  const [chat, setChat] = useState('')
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [results, setResults] = useState([])
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileSearchInput, setMobileSearchInput] = useState('')
  const [recentSearches, setRecentSearches] = useState(() => (safeParseJson(localStorage.getItem(SEARCH_STORAGE_KEY)) || []).slice(0, 6))
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [selectedSavedPlace, setSelectedSavedPlace] = useState(null)
  const [focusedPlaceId, setFocusedPlaceId] = useState(null)
  const [dragPreviewPlaces, setDragPreviewPlaces] = useState(null)
  const [placeComment, setPlaceComment] = useState('')
  const [tag, setTag] = useState('관광')
  const [memo, setMemo] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationNotice, setLocationNotice] = useState('')
  const [placeNotice, setPlaceNotice] = useState('')
  const [inviteNotice, setInviteNotice] = useState('')
  const [activeReactionMessageId, setActiveReactionMessageId] = useState(null)
  const mapRef = useRef(null)
  const mapAreaRef = useRef(null)
  const mapObj = useRef(null)
  const markersRef = useRef([])
  const selectedMarkerRef = useRef(null)
  const routeLinesRef = useRef([])
  const currentMarkerRef = useRef(null)
  const kakaoRef = useRef(null)
  const chatRef = useRef(null)
  const placeDragRef = useRef({ timer: null, id: null, active: false, targetId: null })
  const messagePressRef = useRef({ timer: null, active: false })
  const suppressStoryClickRef = useRef(false)
  const suppressMessageClickRef = useRef(false)
  const placeOrderSaveBlockedRef = useRef(false)
  const chatOpenRef = useRef(chatOpen)
  const mobileViewRef = useRef(mobileView)
  const resizingRef = useRef(false)
  const roomLayoutRef = useRef(null)

  function getStoredPlaceOrder() {
    const stored = safeParseJson(localStorage.getItem(PLACE_ORDER_STORAGE_KEY)) || {}
    return Array.isArray(stored[session.roomId]) ? stored[session.roomId] : []
  }

  function saveStoredPlaceOrder(nextPlaces) {
    const stored = safeParseJson(localStorage.getItem(PLACE_ORDER_STORAGE_KEY)) || {}
    stored[session.roomId] = nextPlaces.map(place => place.id)
    localStorage.setItem(PLACE_ORDER_STORAGE_KEY, JSON.stringify(stored))
  }

  function placeOrderValue(place, storedOrder) {
    const explicitOrder = Number(place.sort_order)
    if (Number.isFinite(explicitOrder)) return explicitOrder
    const storedIndex = storedOrder.indexOf(place.id)
    if (storedIndex >= 0) return storedIndex
    return Number.MAX_SAFE_INTEGER
  }

  function orderPlaces(list) {
    const storedOrder = getStoredPlaceOrder()
    return [...list].sort((a, b) => {
      const orderDiff = placeOrderValue(a, storedOrder) - placeOrderValue(b, storedOrder)
      if (orderDiff !== 0) return orderDiff
      return new Date(a.created_at || 0) - new Date(b.created_at || 0)
    })
  }

  const orderedPlaces = orderPlaces(places)
  const displayPlaces = dragPreviewPlaces || orderedPlaces

  function getPlaceRouteIndex(placeId) {
    return orderedPlaces.findIndex(place => place.id === placeId)
  }

  function isMobileViewport() {
    return window.matchMedia?.('(max-width: 720px)').matches
  }

  function liftMapForMobileSheet() {
    if (!isMobileViewport() || !mapObj.current) return
    setTimeout(() => {
      if (mapObj.current?.panBy) mapObj.current.panBy(0, 132)
    }, 140)
  }

  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (chatOpen) setUnreadCount(0)
  }, [chatOpen])

  useEffect(() => {
    mobileViewRef.current = mobileView
    if (mobileView === 'chat') setUnreadCount(0)
  }, [mobileView])

  useEffect(() => {
    if (!chatRef.current) return
    if (!chatOpen && mobileView !== 'chat') return
    requestAnimationFrame(() => {
      if (!chatRef.current) return
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    })
  }, [messages, chatOpen, mobileView])

  useEffect(() => {
    loadInitial()
    loadJoinedRooms()
    const channel = supabase.channel(`room-${session.roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${session.roomId}` }, payload => {
        setMessages(prev => prev.some(message => message.id === payload.new.id) ? prev : [...prev, payload.new])
        if (!chatOpenRef.current || mobileViewRef.current !== 'chat') setUnreadCount(count => count + 1)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `room_id=eq.${session.roomId}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setPlaces(prev => prev.some(place => place.id === payload.new.id) ? prev : orderPlaces([...prev, payload.new]))
        }
        if (payload.eventType === 'UPDATE') {
          setPlaces(prev => orderPlaces(prev.map(place => place.id === payload.new.id ? payload.new : place)))
        }
        if (payload.eventType === 'DELETE') {
          setPlaces(prev => prev.filter(place => place.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'place_comments', filter: `room_id=eq.${session.roomId}` }, payload => {
        setPlaceComments(prev => prev.some(comment => comment.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `room_id=eq.${session.roomId}` }, payload => {
        if (payload.eventType === 'INSERT') {
          setMessageReactions(prev => prev.some(reaction => reaction.id === payload.new.id) ? prev : [...prev, payload.new])
        }
        if (payload.eventType === 'UPDATE') {
          setMessageReactions(prev => prev.map(reaction => reaction.id === payload.new.id ? payload.new : reaction))
        }
        if (payload.eventType === 'DELETE') {
          setMessageReactions(prev => prev.filter(reaction => reaction.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${session.roomId}` }, loadMembers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${session.roomId}` }, async payload => {
        if (payload.eventType === 'DELETE') {
          const nextRooms = await loadAvailableJoinedRooms(session.roomId)
          if (nextRooms.length > 0) {
            const nextRoom = nextRooms[0]
            const next = { ...session, roomId: nextRoom.id, roomName: nextRoom.name }
            localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(next))
            setJoinedRooms(nextRooms)
            setMobileView('map')
            setSession(next)
            return
          }

          localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
          setSession(null)
          return
        }
        setRoomInfo(payload.new || { owner: '' })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session.roomId, session.username])

  useEffect(() => {
    loadKakaoMap().then(kakao => {
      kakaoRef.current = kakao
      mapObj.current = new kakao.maps.Map(mapRef.current, { center: new kakao.maps.LatLng(37.5665, 126.9780), level: 5 })
      kakao.maps.event.addListener(mapObj.current, 'click', () => {
        setResults([])
        setSelectedPlace(null)
        setSelectedSavedPlace(null)
      })
      kakao.maps.event.addListener(mapObj.current, 'dragstart', () => setResults([]))
      setMapReady(true)
    })
  }, [])

  useEffect(() => {
    if (!mapReady || !kakaoRef.current || !mapObj.current) return
    const refreshMap = () => {
      const center = mapObj.current.getCenter()
      if (typeof mapObj.current.relayout === 'function') mapObj.current.relayout()
      kakaoRef.current.maps.event.trigger(mapObj.current, 'resize')
      mapObj.current.setCenter(center)
    }
    refreshMap()
    const frame = requestAnimationFrame(refreshMap)
    const timers = [80, 180, 320, 520, 760].map(delay => setTimeout(refreshMap, delay))
    window.addEventListener('resize', refreshMap)
    return () => {
      timers.forEach(timer => clearTimeout(timer))
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', refreshMap)
    }
  }, [mapReady, chatOpen])

  useEffect(() => {
    if (!mobileSearchOpen || !kakaoRef.current) return
    const keyword = mobileSearchInput.trim()
    if (keyword.length < 2) {
      setResults([])
      return
    }

    const timer = setTimeout(() => {
      const ps = new kakaoRef.current.maps.services.Places()
      ps.keywordSearch(keyword, (data, status) => {
        if (status === kakaoRef.current.maps.services.Status.OK) {
          setResults(data.slice(0, 8))
        } else {
          setResults([])
        }
      })
    }, 260)

    return () => clearTimeout(timer)
  }, [mobileSearchInput, mobileSearchOpen])

  useEffect(() => {
    if (!mapReady || !kakaoRef.current || !mapObj.current || !mapAreaRef.current) return
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const center = mapObj.current.getCenter()
        if (typeof mapObj.current.relayout === 'function') mapObj.current.relayout()
        kakaoRef.current.maps.event.trigger(mapObj.current, 'resize')
        mapObj.current.setCenter(center)
      })
    })
    observer.observe(mapAreaRef.current)
    return () => observer.disconnect()
  }, [mapReady])

  useEffect(() => {
    if (!mapReady || !navigator.geolocation || !kakaoRef.current || !mapObj.current) return

    async function requestInitialLocation() {
      const alreadyAsked = sessionStorage.getItem('trip_room_location_prompted') === 'true'
      try {
        if (navigator.permissions?.query) {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') return
          if (permission.state === 'prompt' && alreadyAsked) return
        } else if (alreadyAsked) {
          return
        }
      } catch {
        if (alreadyAsked) return
      }

      sessionStorage.setItem('trip_room_location_prompted', 'true')
      moveToCurrentLocation({ silent: true })
    }

    requestInitialLocation()
  }, [mapReady])

  useEffect(() => {
    if (!mapReady || !kakaoRef.current) return
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = orderedPlaces.map((place, index) => {
      const markerContent = document.createElement('button')
      markerContent.type = 'button'
      markerContent.className = 'routeMapPin'
      markerContent.style.setProperty('--route-color', getRouteColor(index))
      markerContent.title = `${index + 1}번째 장소: ${place.name}`
      markerContent.innerHTML = '<span></span>'
      markerContent.addEventListener('click', event => {
        event.stopPropagation()
        focusPlace(place, { openDetail: true })
      })
      return new kakaoRef.current.maps.CustomOverlay({
        position: new kakaoRef.current.maps.LatLng(place.lat, place.lng),
        content: markerContent,
        yAnchor: 1,
        zIndex: 9,
        map: mapObj.current
      })
    })
  }, [places, mapReady])

  useEffect(() => {
    if (!mapReady || !kakaoRef.current || !mapObj.current) return
    routeLinesRef.current.forEach(line => line.setMap(null))
    routeLinesRef.current = []

    const positions = orderedPlaces.map(place => new kakaoRef.current.maps.LatLng(Number(place.lat), Number(place.lng)))
    routeLinesRef.current = positions.slice(0, -1).map((position, index) => {
      return new kakaoRef.current.maps.Polyline({
        map: mapObj.current,
        path: [position, positions[index + 1]],
        strokeWeight: 3,
        strokeColor: getRouteColor(index),
        strokeOpacity: 0.72,
        strokeStyle: 'dash'
      })
    })

    return () => {
      routeLinesRef.current.forEach(line => line.setMap(null))
      routeLinesRef.current = []
    }
  }, [places, mapReady])

  useEffect(() => {
    if (!mapReady || !kakaoRef.current || !mapObj.current) return
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null)
      selectedMarkerRef.current = null
    }
    if (!selectedPlace) return

    const position = new kakaoRef.current.maps.LatLng(Number(selectedPlace.y), Number(selectedPlace.x))
    const markerContent = document.createElement('button')
    markerContent.type = 'button'
    markerContent.className = 'selectedMapPin'
    markerContent.title = `${selectedPlace.place_name} 다시 열기`
    markerContent.innerHTML = '<span></span>'
    markerContent.addEventListener('click', event => {
      event.stopPropagation()
      setSelectedPlace(selectedPlace)
    })
    selectedMarkerRef.current = new kakaoRef.current.maps.CustomOverlay({
      position,
      content: markerContent,
      yAnchor: 1,
      zIndex: 10,
      map: mapObj.current
    })
    mapObj.current.panTo(position)
    liftMapForMobileSheet()
  }, [selectedPlace, mapReady])

  async function loadInitial() {
    const [{ data: msg }, { data: mem }, { data: plc }, { data: room }, { data: comments }, { data: reactions }] = await Promise.all([
      supabase.from('messages').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('room_members').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('places').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('rooms').select('*').eq('id', session.roomId).single(),
      supabase.from('place_comments').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('message_reactions').select('*').eq('room_id', session.roomId).order('created_at')
    ])
    setMessages(msg || [])
    setMessageReactions(reactions || [])
    setMembers(mem || [])
    setPlaces(orderPlaces(plc || []))
    setPlaceComments(comments || [])
    setRoomInfo(room || { owner: '' })
  }

  async function loadJoinedRooms() {
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id, created_at')
      .eq('username', session.username)
      .order('created_at', { ascending: false })

    const roomIds = [...new Set((memberships || []).map(item => item.room_id).filter(Boolean))]
    let rooms = []

    if (roomIds.length > 0) {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .in('id', roomIds)

      const roomById = new Map((data || []).map(room => [room.id, room]))
      rooms = roomIds.map(id => roomById.get(id)).filter(Boolean)
    }

    if (!rooms.some(room => room.id === session.roomId)) {
      rooms.unshift({ id: session.roomId, name: session.roomName })
    }

    setJoinedRooms(rooms)
  }

  async function loadAvailableJoinedRooms(excludedRoomId = session.roomId) {
    const { data: memberships } = await supabase
      .from('room_members')
      .select('room_id, created_at')
      .eq('username', session.username)
      .neq('room_id', excludedRoomId)
      .order('created_at', { ascending: false })

    const roomIds = [...new Set((memberships || []).map(item => item.room_id).filter(Boolean))]
    if (roomIds.length === 0) return []

    const { data } = await supabase
      .from('rooms')
      .select('*')
      .in('id', roomIds)

    const roomById = new Map((data || []).map(room => [room.id, room]))
    return roomIds.map(id => roomById.get(id)).filter(Boolean)
  }

  function rememberJoinedRoom(room) {
    setJoinedRooms(prev => {
      const nextRoom = {
        id: room.id,
        name: room.name,
        owner: room.owner,
        created_at: room.created_at
      }
      const withoutDuplicate = prev.filter(item => item.id !== room.id)
      return [nextRoom, ...withoutDuplicate]
    })
  }

  async function loadAllRooms() {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: false })
    setAllRooms(data || [])
  }

  async function loadMembers() {
    const { data } = await supabase.from('room_members').select('*').eq('room_id', session.roomId).order('created_at')
    if ((data || []).length > 0 && !(data || []).some(member => member.username === session.username)) {
      localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
      setSession(null)
      return
    }
    setMembers(data || [])
  }

  function switchRoom(room) {
    if (room.id === session.roomId) return
    const next = { ...session, roomId: room.id, roomName: room.name }
    localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(next))
    setMobileView('map')
    setSession(next)
  }

  function startChatResize(event) {
    event.preventDefault()
    resizingRef.current = true
    document.body.classList.add('resizingChat')
    const startX = event.clientX
    const startWidth = chatWidth

    function handleMove(moveEvent) {
      if (!resizingRef.current) return
      const nextWidth = Math.max(260, Math.min(420, startWidth - (moveEvent.clientX - startX)))
      if (roomLayoutRef.current) roomLayoutRef.current.style.setProperty('--chat-width', `${nextWidth}px`)
    }

    function handleUp() {
      resizingRef.current = false
      document.body.classList.remove('resizingChat')
      const current = roomLayoutRef.current?.style.getPropertyValue('--chat-width')
      const parsed = current ? Number.parseInt(current, 10) : startWidth
      setChatWidth(Number.isNaN(parsed) ? startWidth : parsed)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  function openRoomManager() {
    setRoomManagerOpen(true)
    setRoomMode('find')
    setRoomError('')
    setRoomQuery('')
    setSelectedJoinRoom(null)
    setRoomForm({ roomName: '', password: '' })
    loadAllRooms()
  }

  async function joinRoomFromManager(room) {
    setRoomError('')
    if (!roomQuery.trim()) return setRoomError('입장할 방 이름을 입력해주세요.')
    if (!room && filteredManagerRooms.length === 0) return setRoomError('검색된 방이 없어요.')
    if (!room) return setRoomError('입장할 방을 목록에서 선택해주세요.')
    if (joinedRooms.some(joinedRoom => joinedRoom.id === room.id)) return setRoomError('이미 속한 방입니다.')
    if (!roomForm.password.trim()) return setRoomError('방 비밀번호를 입력해주세요.')
    if (room.password !== roomForm.password) return setRoomError('방 비밀번호가 달라요.')
    setRoomLoading(true)
    await withMinimumLoading(async () => {
      await supabase.from('room_members').upsert({ room_id: room.id, username: session.username }, { onConflict: 'room_id,username' })
      rememberJoinedRoom(room)
      await loadJoinedRooms()
    })
    setRoomLoading(false)
    setRoomManagerOpen(false)
    switchRoom(room)
  }

  async function createRoomFromManager() {
    setRoomError('')
    if (isGuest) return setRoomError('게스트는 방 만들기를 할 수 없어요. 방 찾기로 참여해주세요.')
    if (!roomForm.roomName.trim() || !roomForm.password.trim()) return setRoomError('방 이름과 비밀번호를 입력해주세요.')
    const roomNameError = validateDisplayName(roomForm.roomName, '방 이름')
    if (roomNameError) return setRoomError(roomNameError)
    setRoomLoading(true)
    const { data, error } = await withMinimumLoading(() => supabase.from('rooms').insert({ name: roomForm.roomName.trim(), password: roomForm.password, owner: session.username }).select().single())
    if (error) {
      setRoomError(error.message)
      setRoomLoading(false)
      return
    }
    await withMinimumLoading(() => supabase.from('room_members').upsert({ room_id: data.id, username: session.username }, { onConflict: 'room_id,username' }))
    rememberJoinedRoom(data)
    await loadJoinedRooms()
    setRoomLoading(false)
    setRoomManagerOpen(false)
    switchRoom(data)
  }

  async function loginFromRoomManager(provider) {
    setRoomError('')
    setRoomAuthLoadingProvider(provider)
    try {
      await onOAuthLogin(provider)
    } catch (error) {
      setRoomError(error.message || '로그인을 시작하지 못했어요.')
      setRoomAuthLoadingProvider('')
    }
  }

  function rememberSearchTerm(value) {
    const term = value.trim()
    if (!term) return
    setRecentSearches(prev => {
      const next = [term, ...prev.filter(item => item !== term)].slice(0, 6)
      localStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function openMobileSearch() {
    if (!window.matchMedia?.('(max-width: 720px)').matches) return false
    setMobileSearchInput(search)
    setResults([])
    setSelectedPlace(null)
    setSelectedSavedPlace(null)
    setMobileSearchOpen(true)
    return true
  }

  function handleSearchFocus() {
    if (!openMobileSearch()) setSearchFocused(true)
  }

  function handleSearchBlur() {
    setTimeout(() => setSearchFocused(false), 140)
  }

  function searchPlaces(keyword = search, options = {}) {
    const trimmed = keyword.trim()
    if (!trimmed || !kakaoRef.current) return
    const ps = new kakaoRef.current.maps.services.Places()
    ps.keywordSearch(trimmed, (data, status) => {
      if (status === kakaoRef.current.maps.services.Status.OK) {
        setResults(data.slice(0, 6))
        setSelectedPlace(null)
        setSearch(trimmed)
        rememberSearchTerm(trimmed)
        const first = data[0]
        mapObj.current.setCenter(new kakaoRef.current.maps.LatLng(first.y, first.x))
        if (options.closeMobile) {
          setMobileSearchOpen(false)
          setMobileView('map')
        }
      }
    })
  }

  function selectSearchResult(place) {
    setSelectedPlace(place)
    setResults([])
    setSearch(place.place_name)
    setSearchFocused(false)
    setMobileSearchInput(place.place_name)
    rememberSearchTerm(place.place_name)
    setMobileSearchOpen(false)
    setMobileView('map')
  }

  function submitMobileSearch() {
    const keyword = mobileSearchInput.trim()
    if (!keyword) return
    searchPlaces(keyword)
  }

  function searchPopularPlace(place) {
    const keyword = place.name
    setSearch(keyword)
    setMobileSearchInput(keyword)
    setSearchFocused(false)
    searchPlaces(keyword)
  }

  function renderPopularPlaces() {
    return <div className="popularPlaces">
      <b>최근 인기 장소</b>
      <div>
        {POPULAR_TRAVEL_PLACES.map(place => <button key={place.name} onClick={() => searchPopularPlace(place)}>
          <span><MapPin size={16} /></span>
          <strong>{place.name}</strong>
          <small>{place.area}</small>
        </button>)}
      </div>
    </div>
  }

  function moveToCurrentLocation(options = {}) {
    const { silent = false } = options
    if (!silent) setLocationNotice('')
    if (!navigator.geolocation) {
      if (!silent) setLocationNotice('이 브라우저에서는 현재 위치를 사용할 수 없어요.')
      return
    }
    if (!kakaoRef.current || !mapObj.current) {
      if (!silent) setLocationNotice('지도가 준비된 뒤 다시 눌러주세요.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude
      const lng = position.coords.longitude
      const next = new kakaoRef.current.maps.LatLng(lat, lng)
      mapObj.current.panTo(next)
      mapObj.current.setLevel(4)
      if (currentMarkerRef.current) currentMarkerRef.current.setMap(null)
      currentMarkerRef.current = new kakaoRef.current.maps.Marker({ position: next, map: mapObj.current })
      if (!silent) setLocationNotice('현재 위치로 이동했어요.')
      setLocating(false)
    }, error => {
      const message = error.code === error.PERMISSION_DENIED
        ? '브라우저 위치 권한을 허용해야 해요.'
        : '현재 위치를 찾지 못했어요. 잠시 후 다시 시도해주세요.'
      if (!silent) setLocationNotice(message)
      setLocating(false)
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 })
  }

  function focusPlace(place, options = {}) {
    const { openDetail = true } = options
    if (!kakaoRef.current || !mapObj.current) return
    setResults([])
    setSelectedPlace(null)
    setSelectedSavedPlace(openDetail ? place : null)
    setFocusedPlaceId(place.id)
    const position = new kakaoRef.current.maps.LatLng(Number(place.lat), Number(place.lng))
    if (typeof mapObj.current.relayout === 'function') mapObj.current.relayout()
    mapObj.current.setLevel(4)
    mapObj.current.setCenter(position)
    if (selectedMarkerRef.current) selectedMarkerRef.current.setMap(null)
    const markerContent = document.createElement('button')
    markerContent.type = 'button'
    markerContent.className = 'selectedMapPin savedPlacePin'
    const routeIndex = getPlaceRouteIndex(place.id)
    markerContent.style.setProperty('--route-color', getRouteColor(routeIndex >= 0 ? routeIndex : 0))
    markerContent.title = `${place.name} 상세 다시 열기`
    markerContent.innerHTML = '<span></span>'
    markerContent.addEventListener('click', event => {
      event.stopPropagation()
      setSelectedSavedPlace(place)
      setFocusedPlaceId(place.id)
    })
    selectedMarkerRef.current = new kakaoRef.current.maps.CustomOverlay({
      position,
      content: markerContent,
      yAnchor: 1,
      zIndex: 11,
      map: mapObj.current
    })
    if (openDetail) liftMapForMobileSheet()
  }

  async function addPlace() {
    if (!selectedPlace) return
    const placeToSave = selectedPlace
    const optimisticId = `temp-${Date.now()}`
    const optimisticPlace = {
      id: optimisticId,
      room_id: session.roomId,
      added_by: session.username,
      name: placeToSave.place_name,
      address: placeToSave.road_address_name || placeToSave.address_name,
      lat: Number(placeToSave.y),
      lng: Number(placeToSave.x),
      tag,
      memo,
      created_at: new Date().toISOString()
    }

    setSelectedPlace(null)
    setResults([])
    setSearch('')
    setMemo('')
    setPlaces(prev => [...prev, optimisticPlace])
    setFocusedPlaceId(optimisticId)
    setPlaceNotice(`${placeToSave.place_name}을 지도에 추가하고 있어요.`)
    focusPlace(optimisticPlace, { openDetail: false })

    const { data, error } = await supabase.from('places').insert({
      room_id: session.roomId,
      added_by: session.username,
      name: placeToSave.place_name,
      address: placeToSave.road_address_name || placeToSave.address_name,
      lat: Number(placeToSave.y),
      lng: Number(placeToSave.x),
      tag,
      memo
    }).select().single()

    if (error) {
      setPlaces(prev => prev.filter(place => place.id !== optimisticId))
      setLocationNotice('장소를 추가하지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }

    if (data) {
      setPlaces(prev => prev.map(place => place.id === optimisticId ? data : place).filter((place, index, array) => array.findIndex(item => item.id === place.id) === index))
      setFocusedPlaceId(data.id)
      focusPlace(data, { openDetail: false })
    }

    await supabase.from('messages').insert({
      room_id: session.roomId,
      username: '알림',
      type: 'system',
      content: `${session.username}님이 [${tag}] ${placeToSave.place_name} 장소를 추가했어요.`
    })
    setPlaceNotice(`${placeToSave.place_name}을 지도에 추가했어요.`)
    setTimeout(() => setPlaceNotice(''), 2400)
  }

  async function addPlaceComment(place) {
    const content = placeComment.trim()
    if (!place || !content) return
    setPlaceComment('')
    const { data, error } = await supabase.from('place_comments').insert({
      room_id: session.roomId,
      place_id: place.id,
      username: session.username,
      content
    }).select().single()

    if (error) {
      setLocationNotice('댓글을 저장하지 못했어요. 댓글 테이블 설정을 확인해주세요.')
      return
    }

    if (data) setPlaceComments(prev => prev.some(comment => comment.id === data.id) ? prev : [...prev, data])

    const messagePayload = {
      placeId: place.id,
      placeName: place.name,
      username: session.username,
      comment: content
    }
    const { data: message } = await supabase.from('messages').insert({
      room_id: session.roomId,
      username: '알림',
      type: 'place_comment',
      content: JSON.stringify(messagePayload)
    }).select().single()
    if (message) setMessages(prev => prev.some(item => item.id === message.id) ? prev : [...prev, message])
  }

  function openPlaceFromMessage(placeId) {
    const place = places.find(item => item.id === placeId)
    if (place) {
      setMobileView('map')
      focusPlace(place, { openDetail: true })
    }
  }

  function parsePlaceMessage(message) {
    try {
      return JSON.parse(message.content)
    } catch {
      return null
    }
  }

  async function sendMessage() {
    const content = chat.trim()
    if (!content) return
    const optimisticId = `temp-message-${Date.now()}`
    const optimisticMessage = {
      id: optimisticId,
      room_id: session.roomId,
      username: session.username,
      content,
      type: 'chat',
      created_at: new Date().toISOString()
    }
    setChat('')
    setMessages(prev => [...prev, optimisticMessage])
    const { data, error } = await supabase
      .from('messages')
      .insert({ room_id: session.roomId, username: session.username, content })
      .select()
      .single()

    if (error) {
      setMessages(prev => prev.filter(message => message.id !== optimisticId))
      setLocationNotice('메시지를 보내지 못했어요. 잠시 후 다시 시도해주세요.')
      return
    }

    if (data) {
      setMessages(prev => prev.map(message => message.id === optimisticId ? data : message))
    }
  }

  async function leaveRoom() {
    await supabase.from('room_members').delete().eq('room_id', session.roomId).eq('username', session.username)
    localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    setSession(null)
  }

  async function deleteRoom() {
    if (!isOwner) return
    const { data, error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', session.roomId)
      .select('id')

    if (error || !data?.length) {
      setDeleteConfirmOpen(false)
      setLocationNotice('방을 삭제하지 못했어요. Supabase의 rooms 삭제 정책을 확인해주세요.')
      return
    }

    const nextRooms = await loadAvailableJoinedRooms(session.roomId)
    if (nextRooms.length > 0) {
      const nextRoom = nextRooms[0]
      const next = { ...session, roomId: nextRoom.id, roomName: nextRoom.name }
      localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(next))
      setJoinedRooms(nextRooms)
      setMobileView('map')
      setDeleteConfirmOpen(false)
      setSession(next)
      return
    }

    localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
    setSession(null)
  }

  async function kickMember(member) {
    if (!isOwner || member.username === session.username) return
    await supabase.from('room_members').delete().eq('room_id', session.roomId).eq('username', member.username)
    await supabase.from('messages').insert({
      room_id: session.roomId,
      username: '알림',
      type: 'system',
      content: `${session.username}님이 ${member.username}님을 내보냈어요.`
    })
  }

  async function transferOwner(member) {
    if (!isOwner || member.username === session.username) return
    const { data } = await supabase.from('rooms').update({ owner: member.username }).eq('id', session.roomId).select().single()
    if (data) setRoomInfo(data)
    await supabase.from('messages').insert({
      room_id: session.roomId,
      username: '알림',
      type: 'system',
      content: `${session.username}님이 ${member.username}님에게 방장을 넘겨줬어요.`
    })
  }

  async function persistPlaceOrder(nextPlaces) {
    saveStoredPlaceOrder(nextPlaces)
    const updates = nextPlaces
      .filter(place => !String(place.id).startsWith('temp-'))
      .map((place, index) => supabase.from('places').update({ sort_order: index }).eq('id', place.id))

    if (updates.length === 0) return
    const results = await Promise.all(updates)
    const failed = results.find(result => result.error)
    if (failed && !placeOrderSaveBlockedRef.current) {
      placeOrderSaveBlockedRef.current = true
      console.warn('장소 순서를 Supabase에 저장하지 못했어요. sort_order 컬럼 마이그레이션이 필요할 수 있어요.', failed.error)
    }
  }

  function reorderPlaces(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return
    const sourceIndex = orderedPlaces.findIndex(place => place.id === sourceId)
    const targetIndex = orderedPlaces.findIndex(place => place.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const nextOrdered = [...orderedPlaces]
    const [movedPlace] = nextOrdered.splice(sourceIndex, 1)
    nextOrdered.splice(targetIndex, 0, movedPlace)
    const withOrder = nextOrdered.map((place, index) => ({ ...place, sort_order: index }))
    const byId = new Map(withOrder.map(place => [place.id, place]))

    setPlaces(prev => prev.map(place => byId.get(place.id) || place))
    persistPlaceOrder(withOrder)
  }

  function previewPlaceOrder(sourceId, targetId) {
    if (!sourceId || !targetId) return
    const basePlaces = dragPreviewPlaces || orderedPlaces
    const sourceIndex = basePlaces.findIndex(place => place.id === sourceId)
    const targetIndex = basePlaces.findIndex(place => place.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return

    const nextPreview = [...basePlaces]
    const [movedPlace] = nextPreview.splice(sourceIndex, 1)
    nextPreview.splice(targetIndex, 0, movedPlace)
    setDragPreviewPlaces(nextPreview)
  }

  function handlePlaceDragStart(event, placeId) {
    placeDragRef.current = { timer: null, id: placeId, active: true, targetId: placeId }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', placeId)
    setDragPreviewPlaces(orderedPlaces)
    setTimeout(() => {
      setFocusedPlaceId(placeId)
    }, 0)
  }

  function handlePlaceDragOver(event, targetId) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || placeDragRef.current.id
    if (!sourceId || sourceId === targetId || placeDragRef.current.targetId === targetId) return
    placeDragRef.current.targetId = targetId
    previewPlaceOrder(sourceId, targetId)
  }

  function handlePlaceDrop(event, targetId) {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || placeDragRef.current.id
    const finalTargetId = placeDragRef.current.targetId || targetId
    reorderPlaces(sourceId, finalTargetId)
    setDragPreviewPlaces(null)
    placeDragRef.current = { timer: null, id: null, active: false, targetId: null }
  }

  function handlePlaceDragEnd() {
    setDragPreviewPlaces(null)
    placeDragRef.current = { timer: null, id: null, active: false, targetId: null }
  }

  function clearPlacePressTimer() {
    if (placeDragRef.current.timer) clearTimeout(placeDragRef.current.timer)
    placeDragRef.current.timer = null
  }

  function startPlaceLongPress(event, placeId) {
    if (event.pointerType === 'mouse') return
    clearPlacePressTimer()
    placeDragRef.current = {
      timer: setTimeout(() => {
        placeDragRef.current.active = true
        placeDragRef.current.targetId = placeId
        suppressStoryClickRef.current = true
        setDragPreviewPlaces(orderedPlaces)
        setFocusedPlaceId(placeId)
      }, 360),
      id: placeId,
      active: false,
      targetId: placeId
    }
  }

  function movePlaceLongPress(event) {
    if (!placeDragRef.current.active) return
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-place-id]')
    const nextTargetId = element?.dataset.placeId
    if (nextTargetId && placeDragRef.current.targetId !== nextTargetId) {
      placeDragRef.current.targetId = nextTargetId
      previewPlaceOrder(placeDragRef.current.id, nextTargetId)
      setFocusedPlaceId(nextTargetId)
    }
  }

  function finishPlaceLongPress() {
    const { id, active, targetId } = placeDragRef.current
    clearPlacePressTimer()
    if (active) reorderPlaces(id, targetId)
    setDragPreviewPlaces(null)
    placeDragRef.current = { timer: null, id: null, active: false, targetId: null }
    setTimeout(() => {
      suppressStoryClickRef.current = false
    }, 80)
  }

  function handlePlaceStoryClick(place) {
    if (suppressStoryClickRef.current) return
    focusPlace(place)
    setMobileView('map')
  }

  function getMessageReactionSummary(messageId) {
    return MESSAGE_REACTIONS
      .map(emoji => {
        const items = messageReactions.filter(reaction => reaction.message_id === messageId && reaction.emoji === emoji)
        return { emoji, count: items.length, mine: items.some(reaction => reaction.username === session.username) }
      })
      .filter(item => item.count > 0)
  }

  function getMyMessageReaction(messageId) {
    return messageReactions.find(reaction => reaction.message_id === messageId && reaction.username === session.username)
  }

  function openReactionPicker(messageId) {
    setActiveReactionMessageId(prev => prev === messageId ? null : messageId)
  }

  function handleMessageClick(messageId) {
    if (isMobileViewport() || suppressMessageClickRef.current) return
    openReactionPicker(messageId)
  }

  function startMessageLongPress(event, messageId) {
    if (event.pointerType === 'mouse') return
    if (messagePressRef.current.timer) clearTimeout(messagePressRef.current.timer)
    messagePressRef.current = {
      active: false,
      timer: setTimeout(() => {
        messagePressRef.current.active = true
        suppressMessageClickRef.current = true
        setActiveReactionMessageId(messageId)
      }, 420)
    }
  }

  function finishMessageLongPress() {
    if (messagePressRef.current.timer) clearTimeout(messagePressRef.current.timer)
    const wasActive = messagePressRef.current.active
    messagePressRef.current = { timer: null, active: false }
    if (wasActive) {
      setTimeout(() => {
        suppressMessageClickRef.current = false
      }, 120)
    }
  }

  async function toggleMessageReaction(message, emoji) {
    const currentReaction = getMyMessageReaction(message.id)
    setActiveReactionMessageId(null)

    if (currentReaction?.emoji === emoji) {
      setMessageReactions(prev => prev.filter(reaction => reaction.id !== currentReaction.id))
      await supabase.from('message_reactions').delete().eq('id', currentReaction.id)
      return
    }

    if (currentReaction) {
      const optimistic = { ...currentReaction, emoji }
      setMessageReactions(prev => prev.map(reaction => reaction.id === currentReaction.id ? optimistic : reaction))
      await supabase.from('message_reactions').update({ emoji }).eq('id', currentReaction.id)
      return
    }

    const optimisticReaction = {
      id: `temp-${Date.now()}`,
      room_id: session.roomId,
      message_id: message.id,
      username: session.username,
      emoji,
      created_at: new Date().toISOString()
    }
    setMessageReactions(prev => [...prev, optimisticReaction])
    const { data, error } = await supabase.from('message_reactions').insert({
      room_id: session.roomId,
      message_id: message.id,
      username: session.username,
      emoji
    }).select().single()

    if (error) {
      setMessageReactions(prev => prev.filter(reaction => reaction.id !== optimisticReaction.id))
      return
    }
    if (data) {
      setMessageReactions(prev => prev
        .map(reaction => reaction.id === optimisticReaction.id ? data : reaction)
        .filter((reaction, index, array) => array.findIndex(item => item.id === reaction.id) === index))
    }
  }

  function renderReactionControls(message) {
    const summary = getMessageReactionSummary(message.id)
    return <>
      {activeReactionMessageId === message.id && <div className="reactionPicker" onClick={event => event.stopPropagation()}>
        {MESSAGE_REACTIONS.map(emoji => {
          const active = getMyMessageReaction(message.id)?.emoji === emoji
          return <button key={emoji} className={active ? 'active' : ''} onClick={() => toggleMessageReaction(message, emoji)}>{emoji}</button>
        })}
      </div>}
      {summary.length > 0 && <div className="reactionSummary">
        {summary.map(item => <button key={item.emoji} className={item.mine ? 'mine' : ''} onClick={event => { event.stopPropagation(); toggleMessageReaction(message, item.emoji) }}>
          <span>{item.emoji}</span>
          <b>{item.count}</b>
        </button>)}
      </div>}
    </>
  }

  async function copyInviteLink() {
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${session.roomId}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setInviteNotice('초대 링크가 복사되었습니다.')
    } catch {
      setInviteNotice(inviteUrl)
    }
    setTimeout(() => setInviteNotice(''), 2400)
  }

  const filteredManagerRooms = allRooms
    .filter(room => room.name.toLowerCase().includes(roomQuery.trim().toLowerCase()))
    .slice(0, 6)
  const ownerName = roomInfo?.owner || members[0]?.username || ''
  const isOwner = ownerName === session.username

  function renderPlaceStories() {
    return <>
      <div className="placeStoryScroller">
        <button className="placeStory addPlaceStory" onClick={openMobileSearch} title="장소 추가">
          <span className="placeStoryRing"><Plus size={26} /></span>
          <strong>장소 추가</strong>
          <small>검색</small>
        </button>
        {displayPlaces.map((p, index) => <button
          key={p.id}
          className={focusedPlaceId === p.id ? 'placeStory active' : 'placeStory'}
          data-place-id={p.id}
          draggable
          onClick={() => handlePlaceStoryClick(p)}
          onDragStart={event => handlePlaceDragStart(event, p.id)}
          onDragOver={event => handlePlaceDragOver(event, p.id)}
          onDrop={event => handlePlaceDrop(event, p.id)}
          onDragEnd={handlePlaceDragEnd}
          onPointerDown={event => startPlaceLongPress(event, p.id)}
          onPointerMove={movePlaceLongPress}
          onPointerUp={finishPlaceLongPress}
          onPointerCancel={finishPlaceLongPress}
          title={`${p.name} 위치로 이동`}
        >
        <span className="placeStoryRing" style={{ '--route-color': getRouteColor(index) }}>
          <MapPin size={22} />
          <em className="placeOrderBadge" style={{ '--route-color': getRouteColor(index) }}>{index + 1}</em>
        </span>
        <strong>{p.name}</strong>
        <small>#{p.tag}</small>
        </button>)}
      </div>
      {places.length === 0 && <p className="emptyState">아직 추가된 장소가 없어요.</p>}
    </>
  }

  return <div ref={roomLayoutRef} className={`${chatOpen ? 'room' : 'room chatCollapsed'} mobile-${mobileView}${selectedPlace || selectedSavedPlace ? ' placeSheetOpen' : ''}`} style={{ '--chat-width': `${chatWidth}px` }}>
    <aside className="roomList">
      <div className="roomListTop">
        <div className="brandLockup"><span><LogoMark /></span><b>어디가</b></div>
        <button className="iconButton addRoomButton" onClick={openRoomManager} title="방 추가"><Plus size={21} /></button>
      </div>
      <p className="roomListLabel">내 룸</p>
      <nav className="roomNav">
        {joinedRooms.map(room => {
          const active = room.id === session.roomId
          return <button key={room.id} className={active ? 'roomItem active' : 'roomItem'} onClick={() => switchRoom(room)} title={room.name}>
            <span className="roomAvatar">{room.name.slice(0, 1)}</span>
            <span><b>{room.name}</b><small>{active ? `${members.length}명` : '참여 중'}</small></span>
          </button>
        })}
      </nav>
      <div className="roomProfile">
        <span>{profileName.slice(0, 1)}</span>
        <div>
          <b>{profileName}</b>
          <small>{getProviderLabel(profileProvider)}</small>
        </div>
        <button className="iconButton" onClick={onLogout} title="로그아웃"><LogOut size={18} /></button>
      </div>
    </aside>
    <main className="mapArea" ref={mapAreaRef}>
      <section className="mobileMapTop">
        <header className="sideHeader">
          <div>
            <h2><span className="mobileBrandMark"><LogoMark /></span>어디가</h2>
          </div>
          <button className="iconButton mobileHeaderLogout" onClick={onLogout} title="로그아웃"><LogOut size={18} /></button>
        </header>
        <section className="places">
          <b>추가된 장소</b>
          {renderPlaceStories()}
        </section>
      </section>
      <div className="mapSearch">
        <div className="searchBox">
          <Search size={20} />
          <input placeholder="장소 검색 예: 오사카 맛집" value={search} onFocus={handleSearchFocus} onBlur={handleSearchBlur} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPlaces()} />
          {search && <button className="clearSearch" onClick={() => { setSearch(''); setResults([]); setSelectedPlace(null); setSearchFocused(true) }} title="검색어 지우기"><X size={18} /></button>}
          <button onClick={() => openMobileSearch() || searchPlaces()}>검색</button>
        </div>
        {results.length > 0 && <div className="results">
          {results.map(r => <button key={r.id} onClick={() => selectSearchResult(r)}><b>{r.place_name}</b><span>{r.road_address_name || r.address_name}</span></button>)}
        </div>}
        {searchFocused && !search.trim() && results.length === 0 && <div className="results popularResults">
          {renderPopularPlaces()}
        </div>}
      </div>
      {mobileSearchOpen && <section className="mobileSearchPage">
        <div className="mobileSearchHead">
          <button className="iconButton" onClick={() => { setMobileSearchOpen(false); setResults([]) }} title="뒤로"><ArrowLeft size={22} /></button>
          <div className="mobileSearchInput">
            <Search size={19} />
            <input autoFocus placeholder="장소 검색" value={mobileSearchInput} onChange={e => setMobileSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitMobileSearch()} />
            {mobileSearchInput && <button onClick={() => { setMobileSearchInput(''); setResults([]) }} title="검색어 지우기"><X size={16} /></button>}
          </div>
          <button className="mobileSearchSubmit" onClick={submitMobileSearch}>검색</button>
        </div>
        <div className="mobileSearchBody">
          {mobileSearchInput.trim().length < 2 && recentSearches.length > 0 && <>
            <b>최근 검색</b>
            <div className="recentSearches">
              {recentSearches.map(term => <button key={term} onClick={() => { setMobileSearchInput(term); searchPlaces(term) }}>{term}</button>)}
            </div>
          </>}
          {mobileSearchInput.trim().length < 2 && renderPopularPlaces()}
          {mobileSearchInput.trim().length >= 2 && <div className="mobileSearchResults">
            {results.length > 0
              ? results.map(result => <button key={result.id} onClick={() => selectSearchResult(result)}>
                <span><MapPin size={18} /></span>
                <div>
                  <b>{result.place_name}</b>
                  <small>{result.road_address_name || result.address_name}</small>
                </div>
              </button>)
              : <p>검색어를 입력하면 연관 장소가 표시돼요.</p>}
          </div>}
        </div>
      </section>}
      <button className="locateButton" onClick={moveToCurrentLocation} disabled={locating} title="현재 위치로 이동">
        <LocateFixed size={21} />
        <span>{locating ? '찾는 중' : '내 위치'}</span>
      </button>
      {locationNotice && <div className="locationNotice">{locationNotice}</div>}
      {placeNotice && <div className="placeNotice">{placeNotice}</div>}
      {selectedPlace && <div className="addPanel">
        <div className="sheetHandle" />
        <div className="addPanelHead">
          <div>
            <b>{selectedPlace.place_name}</b>
            <span>{selectedPlace.road_address_name || selectedPlace.address_name}</span>
          </div>
          <button className="iconButton" onClick={() => setSelectedPlace(null)} title="닫기"><X size={20} /></button>
        </div>
        <div className="tagPills">{TAGS.map(t => <button key={t} className={tag === t ? 'active' : ''} onClick={() => setTag(t)}>{t}</button>)}</div>
        <input placeholder="메모 선택" value={memo} onChange={e => setMemo(e.target.value)} />
        <button onClick={addPlace}><MapPin size={18} /> 지도에 추가하기</button>
      </div>}
      {selectedSavedPlace && <div className="placeDetailPanel">
        <div className="sheetHandle" />
        <div className="addPanelHead">
          <div>
            <b>{selectedSavedPlace.name}</b>
            <span>{selectedSavedPlace.address}</span>
          </div>
          <button className="iconButton" onClick={() => setSelectedSavedPlace(null)} title="닫기"><X size={20} /></button>
        </div>
        <div className="placeMeta">
          <span>#{selectedSavedPlace.tag}</span>
          <span>{selectedSavedPlace.added_by}님이 등록</span>
        </div>
        <div className="placeMapLinks">
          <a className="kakaoMapLink" href={buildMapSearchUrl('kakao', selectedSavedPlace)} target="_blank" rel="noreferrer"><span><KakaoLogo /></span>카카오맵 가기</a>
          <a className="naverMapLink" href={buildMapSearchUrl('naver', selectedSavedPlace)} target="_blank" rel="noreferrer"><span>N</span>네이버맵 가기</a>
        </div>
        <div className="placeMemo">
          <b>메모</b>
          <p>{selectedSavedPlace.memo?.trim() || '등록된 메모가 없어요.'}</p>
        </div>
        <div className="placeComments">
          <b>댓글</b>
          <div className="placeCommentList">
            {placeComments.filter(comment => comment.place_id === selectedSavedPlace.id).length > 0
              ? placeComments.filter(comment => comment.place_id === selectedSavedPlace.id).map(comment => <div key={comment.id}>
                <strong>{comment.username}</strong>
                <p>{comment.content}</p>
              </div>)
              : <p className="emptyState compact">아직 댓글이 없어요.</p>}
          </div>
          <div className="placeCommentForm">
            <input placeholder="댓글 남기기" value={placeComment} onChange={e => setPlaceComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlaceComment(selectedSavedPlace)} />
            <button onClick={() => addPlaceComment(selectedSavedPlace)}>등록</button>
          </div>
        </div>
      </div>}
      <div ref={mapRef} className="map" />
    </main>
    <aside className="side">
      {chatOpen && <div className="chatResizeHandle" onMouseDown={startChatResize} title="채팅 폭 조절" />}
      {chatOpen ? <>
        <header className="sideHeader">
          <div>
            <h2>{session.roomName}{isOwner && <Crown className="ownerTitleIcon" size={15} />}</h2>
            <p>{members.length}명 · 저장된 장소 {places.length}곳</p>
          </div>
          <div className="toolbarActions">
            <button className="iconButton" onClick={() => setMembersOpen(true)} title="함께 있는 사람"><Users size={21} /></button>
            <button className="iconButton chatCollapseButton" onClick={() => setChatOpen(false)} title="채팅 접기"><PanelRightClose size={21} /></button>
            {isOwner && <button className="iconButton danger" onClick={() => setDeleteConfirmOpen(true)} title="방 삭제"><Trash2 size={21} /></button>}
            <button className="iconButton danger" onClick={() => setLeaveConfirmOpen(true)} title="나가기"><LogOut size={21} /></button>
          </div>
        </header>
        <section className="places">
          <b>추가된 장소</b>
          {renderPlaceStories()}
        </section>
        <div className="chatStack">
          <div className="inviteStrip">
            <button onClick={copyInviteLink}><Link2 size={17} /> 초대하기</button>
            {inviteNotice && <span>{inviteNotice}</span>}
          </div>
          <section className="chat" ref={chatRef}>{messages.length > 0 ? messages.map(m => {
          const placeMessage = m.type === 'place_comment' ? parsePlaceMessage(m) : null
          if (placeMessage) {
            return <div
              key={m.id}
              className="system msg placeMessage"
              onClick={() => handleMessageClick(m.id)}
              onPointerDown={event => startMessageLongPress(event, m.id)}
              onPointerUp={finishMessageLongPress}
              onPointerCancel={finishMessageLongPress}
              onPointerLeave={finishMessageLongPress}
            >
              <b>알림</b>
              <p>{placeMessage.username}님이 {placeMessage.placeName}에 댓글을 남겼어요.</p>
              <button onClick={event => { event.stopPropagation(); openPlaceFromMessage(placeMessage.placeId) }}>확인하러 가기</button>
              {renderReactionControls(m)}
            </div>
          }
          return <div
            key={m.id}
            className={m.type === 'system' ? 'system msg' : 'msg'}
            onClick={() => handleMessageClick(m.id)}
            onPointerDown={event => startMessageLongPress(event, m.id)}
            onPointerUp={finishMessageLongPress}
            onPointerCancel={finishMessageLongPress}
            onPointerLeave={finishMessageLongPress}
          >
            <b>{m.username}</b>
            <p>{m.content}</p>
            {renderReactionControls(m)}
          </div>
        }) : <div className="emptyChat">아직 채팅이 없어요.</div>}</section>
        </div>
        <footer><button className="roundButton" title="이미지"><Image size={21} /></button><input placeholder="메시지 입력..." value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} /><button className="roundButton send" onClick={sendMessage} title="전송"><Send size={20} /></button></footer>
      </> : <div className="chatRail">
        <button className="railButton" onClick={() => setChatOpen(true)} title="채팅 펼치기">
          <MessageCircle size={23} />
          {unreadCount > 0 && <span className="unreadDot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>
      </div>}
    </aside>
    <nav className="mobileTabBar">
      <button className={mobileView === 'rooms' ? 'active' : ''} onClick={() => setMobileView('rooms')}>
        <MapPin size={20} />
        <span>내 룸</span>
      </button>
      <button className={mobileView === 'map' ? 'active' : ''} onClick={() => setMobileView('map')}>
        <LocateFixed size={20} />
        <span>지도</span>
      </button>
      <button className={mobileView === 'chat' ? 'active' : ''} onClick={() => { setMobileView('chat'); setChatOpen(true); setUnreadCount(0) }}>
        <MessageCircle size={20} />
        <span>채팅</span>
        {unreadCount > 0 && <em>{unreadCount > 9 ? '9+' : unreadCount}</em>}
      </button>
    </nav>
    {membersOpen && <div className="modalBackdrop" onClick={() => setMembersOpen(false)}>
      <div className="membersModal" onClick={e => e.stopPropagation()}>
        <div className="modalHead">
          <div>
            <b>함께 있는 사람</b>
            <span>{session.roomName}</span>
          </div>
          <button className="iconButton" onClick={() => setMembersOpen(false)} title="닫기"><X size={20} /></button>
        </div>
        <div className="memberList">{members.map(m => {
          const memberIsOwner = m.username === ownerName
          const canManage = isOwner && m.username !== session.username
          return <div key={m.id}>
            <span>{m.username.slice(0, 1)}</span>
            <b>{m.username}</b>
            {memberIsOwner && <em><Crown size={13} /> 방장</em>}
            {canManage && <div className="memberActions">
              <button onClick={() => transferOwner(m)} title="방장 넘기기"><Crown size={16} /></button>
              <button className="danger" onClick={() => kickMember(m)} title="내보내기"><UserMinus size={16} /></button>
            </div>}
          </div>
        })}</div>
      </div>
    </div>}
    {leaveConfirmOpen && <div className="modalBackdrop" onClick={() => setLeaveConfirmOpen(false)}>
      <div className="confirmModal" onClick={e => e.stopPropagation()}>
        <b>방을 나갈까요?</b>
        <p>{session.roomName}에서 나가면 다시 입장하려면 비밀번호가 필요해요.</p>
        <div>
          <button onClick={() => setLeaveConfirmOpen(false)}>취소</button>
          <button className="destructive" onClick={leaveRoom}>나가기</button>
        </div>
      </div>
    </div>}
    {deleteConfirmOpen && <div className="modalBackdrop" onClick={() => setDeleteConfirmOpen(false)}>
      <div className="confirmModal" onClick={e => e.stopPropagation()}>
        <b>방을 삭제할까요?</b>
        <p>{session.roomName} 방과 채팅, 장소, 댓글이 모두 삭제돼요. 이 작업은 되돌릴 수 없어요.</p>
        <div>
          <button onClick={() => setDeleteConfirmOpen(false)}>취소</button>
          <button className="destructive" onClick={deleteRoom}>삭제</button>
        </div>
      </div>
    </div>}
    {roomManagerOpen && <div className="modalBackdrop" onClick={() => setRoomManagerOpen(false)}>
      <div className="roomManagerModal" onClick={e => e.stopPropagation()}>
        <div className="modalHead">
          <div>
            <b>방 추가</b>
            <span>{isGuest && roomMode === 'create' ? '로그인하면 직접 방을 만들 수 있어요.' : `${session.username}님이 참여할 방을 관리해요.`}</span>
          </div>
          <button className="iconButton" onClick={() => setRoomManagerOpen(false)} title="닫기"><X size={20} /></button>
        </div>
        <div className="tabs compact" role="tablist">
          <button className={roomMode === 'find' ? 'active' : ''} onClick={() => { setRoomMode('find'); setRoomError('') }}>방 찾기</button>
          <button className={roomMode === 'create' ? 'active' : ''} onClick={() => { setRoomMode('create'); setRoomError('') }}>방 만들기</button>
        </div>
        {isGuest && roomMode === 'find' && <div className="guestNotice">게스트는 방 참가만 가능해요.</div>}
        {isGuest && roomMode === 'create' ? <div className="roomCreateLoginPanel">
          <p>방을 새로 만들려면 소셜 로그인이 필요해요.</p>
          <div className="authActions roomAuthActions">
            <button className="oauthButton kakao" disabled={Boolean(roomAuthLoadingProvider)} onClick={() => loginFromRoomManager('kakao')}>
              <span className="socialLogo kakaoLogo"><KakaoLogo /></span>
              <span>{roomAuthLoadingProvider === 'kakao' ? '카카오 연결 중...' : '카카오계정 로그인'}</span>
            </button>
            <button className="oauthButton google" disabled={Boolean(roomAuthLoadingProvider)} onClick={() => loginFromRoomManager('google')}>
              <span className="socialLogo googleLogo"><GoogleLogo /></span>
              <span>{roomAuthLoadingProvider === 'google' ? '구글 연결 중...' : 'Google로 시작하기'}</span>
            </button>
          </div>
        </div> : <>
          <div className="formStack managerForm">
            {roomMode === 'find' && <>
              <label><span>방 검색</span><input placeholder="방 이름 입력" value={roomQuery} onChange={e => { setRoomQuery(e.target.value); setSelectedJoinRoom(null) }} /></label>
              {roomQuery.trim() && <div className="roomSuggestions">
                {filteredManagerRooms.map(room => (
                  <button key={room.id} className={selectedJoinRoom?.id === room.id ? 'active' : ''} onClick={() => { setSelectedJoinRoom(room); setRoomQuery(room.name) }}>
                    <span>{room.name.slice(0, 1)}</span>
                    <b>{room.name}</b>
                  </button>
                ))}
                {roomQuery.trim() && filteredManagerRooms.length === 0 && <p>검색된 방이 없어요.</p>}
              </div>}
            </>}
            {roomMode === 'create' && <label><span>방 이름</span><input maxLength={MAX_NAME_LENGTH} placeholder="예: 제주 어디가" value={roomForm.roomName} onChange={e => setRoomForm({ ...roomForm, roomName: e.target.value })} /></label>}
            <label><span>비밀번호</span><input placeholder="방 비밀번호" type="password" value={roomForm.password} onChange={e => setRoomForm({ ...roomForm, password: e.target.value })} /></label>
          </div>
          <button className="primary modalPrimary" disabled={roomLoading} onClick={() => roomMode === 'create' ? createRoomFromManager() : joinRoomFromManager(selectedJoinRoom)}>
            {roomLoading ? '처리 중...' : roomMode === 'create' ? '방 만들고 이동' : '방 입장하기'}
          </button>
        </>}
        {roomError && <div className="error">{roomError}</div>}
      </div>
    </div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
