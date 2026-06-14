import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Crown, Image, LocateFixed, LogOut, MapPin, MessageCircle, PanelRightClose, Plus, Search, Send, UserMinus, Users, X } from 'lucide-react'
import { supabase } from './supabase'
import './style.css'

const TAGS = ['관광', '식당', '숙소', '카페', '기타']
const MAX_NAME_LENGTH = 10
const MIN_LOADING_MS = 700
const BLOCKED_WORDS = ['시발', '씨발', '병신', '좆', '개새끼', 'fuck', 'shit']

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
  const savedSession = JSON.parse(localStorage.getItem('trip_room_session') || 'null')
  const [session, setSession] = useState(savedSession)
  const showLanding = false
  const [landingOpen, setLandingOpen] = useState(() => showLanding && sessionStorage.getItem('trip_room_landing_seen') !== 'true')
  function startService() {
    sessionStorage.setItem('trip_room_landing_seen', 'true')
    setLandingOpen(false)
  }
  if (landingOpen) return <Landing onStart={startService} />
  return session ? <Room session={session} setSession={setSession} /> : <Lobby setSession={setSession} />
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
        <span><MapPin size={19} /></span>
        <b>어디가지</b>
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
          <span>어디가지 · 여행 지도 방</span>
        </div>
        <h1>여행 장소를<br />같이 모으세요.</h1>
        <p>친구들과 함께 여행 장소를 지도에 모으고, 실시간으로 공유하는 협업 여행 지도 서비스입니다.</p>
        <div className="heroActions">
          <button className="heroPrimary" onClick={onStart}>시작하기</button>
          <a href="#flow">작동 방식 보기</a>
        </div>
      </div>

      <div className="heroVisual" aria-hidden="true">
        <div className="mapOrb">
          <span className="mapOrbPin"><MapPin size={34} /></span>
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

function Lobby({ setSession }) {
  const [mode, setMode] = useState('find')
  const [rooms, setRooms] = useState([])
  const [form, setForm] = useState({ roomName: '', password: '', username: '' })
  const [roomQuery, setRoomQuery] = useState('')
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const lobbyMapRef = useRef(null)

  useEffect(() => { fetchRooms() }, [])

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

  async function enterRoom(room) {
    setError('')
    if (!form.username.trim() || !form.password.trim()) return setError('이름과 비밀번호를 입력해주세요.')
    const usernameError = validateDisplayName(form.username, '사용자 이름')
    if (usernameError) return setError(usernameError)
    if (room.password !== form.password) return setError('방 비밀번호가 달라요.')
    setLoading(true)
    try {
      await withMinimumLoading(() => supabase.from('room_members').upsert({ room_id: room.id, username: form.username.trim() }, { onConflict: 'room_id,username' }))
      const next = { roomId: room.id, roomName: room.name, username: form.username.trim() }
      localStorage.setItem('trip_room_session', JSON.stringify(next))
      setSession(next)
    } catch (error) {
      setError(error.message || '입장 중 문제가 발생했습니다.')
      setLoading(false)
    }
  }

  async function createRoom() {
    setError('')
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

  const filteredRooms = rooms
    .filter(room => room.name.toLowerCase().includes(roomQuery.trim().toLowerCase()))
    .slice(0, 5)

  return <div className="lobby">
    <div ref={lobbyMapRef} className="lobbyMap" aria-hidden="true" />
    <div className="card">
      <div className="appMark"><MapPin size={22} /></div>
      <h1>어디가지</h1>
      <p>친구들과 함께 여행 장소를 지도에 모으고, 실시간으로 공유하는 협업 여행 지도 서비스</p>
      <div className="tabs" role="tablist">
        <button className={mode === 'find' ? 'active' : ''} onClick={() => { setMode('find'); setError('') }}>방 찾기</button>
        <button className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setError('') }}>방 만들기</button>
      </div>
      <div className="formStack">
        {mode === 'create' && <label><span>방 이름</span><input maxLength={MAX_NAME_LENGTH} placeholder="예: 부산 어디가지" value={form.roomName} onChange={e => setForm({ ...form, roomName: e.target.value })} /></label>}
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
      <button className="primary" disabled={loading} onClick={() => mode === 'create' ? createRoom() : selectedRoom && enterRoom(selectedRoom)}>{loading ? '준비 중...' : mode === 'create' ? '방 만들고 입장' : '입장하기'}</button>
    </div>
    {loading && <div className="loadingOverlay"><div className="spinner" /><b>{mode === 'create' ? '방을 만들고 있어요' : '방에 입장하고 있어요'}</b></div>}
  </div>
}

function Room({ session, setSession }) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [places, setPlaces] = useState([])
  const [placeComments, setPlaceComments] = useState([])
  const [roomInfo, setRoomInfo] = useState({ owner: '' })
  const [joinedRooms, setJoinedRooms] = useState([])
  const [chatOpen, setChatOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [membersOpen, setMembersOpen] = useState(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [chatWidth, setChatWidth] = useState(380)
  const [roomManagerOpen, setRoomManagerOpen] = useState(false)
  const [roomMode, setRoomMode] = useState('find')
  const [allRooms, setAllRooms] = useState([])
  const [roomQuery, setRoomQuery] = useState('')
  const [selectedJoinRoom, setSelectedJoinRoom] = useState(null)
  const [roomForm, setRoomForm] = useState({ roomName: '', password: '' })
  const [roomError, setRoomError] = useState('')
  const [roomLoading, setRoomLoading] = useState(false)
  const [mobileView, setMobileView] = useState('map')
  const [chat, setChat] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [selectedSavedPlace, setSelectedSavedPlace] = useState(null)
  const [focusedPlaceId, setFocusedPlaceId] = useState(null)
  const [placeComment, setPlaceComment] = useState('')
  const [tag, setTag] = useState('관광')
  const [memo, setMemo] = useState('')
  const [mapReady, setMapReady] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationNotice, setLocationNotice] = useState('')
  const [placeNotice, setPlaceNotice] = useState('')
  const mapRef = useRef(null)
  const mapAreaRef = useRef(null)
  const mapObj = useRef(null)
  const markersRef = useRef([])
  const selectedMarkerRef = useRef(null)
  const currentMarkerRef = useRef(null)
  const kakaoRef = useRef(null)
  const chatOpenRef = useRef(chatOpen)
  const mobileViewRef = useRef(mobileView)
  const resizingRef = useRef(false)
  const roomLayoutRef = useRef(null)

  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (chatOpen) setUnreadCount(0)
  }, [chatOpen])

  useEffect(() => {
    mobileViewRef.current = mobileView
    if (mobileView === 'chat') setUnreadCount(0)
  }, [mobileView])

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
          setPlaces(prev => prev.some(place => place.id === payload.new.id) ? prev : [...prev, payload.new])
        }
        if (payload.eventType === 'UPDATE') {
          setPlaces(prev => prev.map(place => place.id === payload.new.id ? payload.new : place))
        }
        if (payload.eventType === 'DELETE') {
          setPlaces(prev => prev.filter(place => place.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'place_comments', filter: `room_id=eq.${session.roomId}` }, payload => {
        setPlaceComments(prev => prev.some(comment => comment.id === payload.new.id) ? prev : [...prev, payload.new])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${session.roomId}` }, loadMembers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${session.roomId}` }, payload => setRoomInfo(payload.new || { owner: '' }))
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
    markersRef.current = places.map(place => {
      const marker = new kakaoRef.current.maps.Marker({ position: new kakaoRef.current.maps.LatLng(place.lat, place.lng), map: mapObj.current })
      kakaoRef.current.maps.event.addListener(marker, 'click', () => focusPlace(place, { openDetail: true }))
      return marker
    })
  }, [places, mapReady])

  useEffect(() => {
    if (!mapReady || !kakaoRef.current || !mapObj.current) return
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null)
      selectedMarkerRef.current = null
    }
    if (!selectedPlace) return

    const position = new kakaoRef.current.maps.LatLng(Number(selectedPlace.y), Number(selectedPlace.x))
    const markerContent = '<div class="selectedMapPin"><span></span></div>'
    selectedMarkerRef.current = new kakaoRef.current.maps.CustomOverlay({
      position,
      content: markerContent,
      yAnchor: 1,
      zIndex: 10,
      map: mapObj.current
    })
    mapObj.current.panTo(position)
  }, [selectedPlace, mapReady])

  async function loadInitial() {
    const [{ data: msg }, { data: mem }, { data: plc }, { data: room }, { data: comments }] = await Promise.all([
      supabase.from('messages').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('room_members').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('places').select('*').eq('room_id', session.roomId).order('created_at'),
      supabase.from('rooms').select('*').eq('id', session.roomId).single(),
      supabase.from('place_comments').select('*').eq('room_id', session.roomId).order('created_at')
    ])
    setMessages(msg || [])
    setMembers(mem || [])
    setPlaces(plc || [])
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
      localStorage.removeItem('trip_room_session')
      setSession(null)
      return
    }
    setMembers(data || [])
  }

  function switchRoom(room) {
    if (room.id === session.roomId) return
    const next = { ...session, roomId: room.id, roomName: room.name }
    localStorage.setItem('trip_room_session', JSON.stringify(next))
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
    setRoomError('')
    setRoomQuery('')
    setSelectedJoinRoom(null)
    setRoomForm({ roomName: '', password: '' })
    loadAllRooms()
  }

  async function joinRoomFromManager(room) {
    setRoomError('')
    if (!room) return setRoomError('입장할 방을 선택해주세요.')
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

  function searchPlaces() {
    if (!search.trim() || !kakaoRef.current) return
    const ps = new kakaoRef.current.maps.services.Places()
    ps.keywordSearch(search, (data, status) => {
      if (status === kakaoRef.current.maps.services.Status.OK) {
        setResults(data.slice(0, 6))
        setSelectedPlace(null)
        const first = data[0]
        mapObj.current.setCenter(new kakaoRef.current.maps.LatLng(first.y, first.x))
      }
    })
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
    selectedMarkerRef.current = new kakaoRef.current.maps.CustomOverlay({
      position,
      content: '<div class="selectedMapPin savedPlacePin"><span></span></div>',
      yAnchor: 1,
      zIndex: 11,
      map: mapObj.current
    })
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
    localStorage.removeItem('trip_room_session')
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

  const filteredManagerRooms = allRooms
    .filter(room => room.name.toLowerCase().includes(roomQuery.trim().toLowerCase()))
    .slice(0, 6)
  const ownerName = roomInfo?.owner || members[0]?.username || ''
  const isOwner = ownerName === session.username

  function renderPlaceStories() {
    return places.length > 0 ? <div className="placeStoryScroller">
      {places.map(p => <button key={p.id} className={focusedPlaceId === p.id ? 'placeStory active' : 'placeStory'} onClick={() => { focusPlace(p); setMobileView('map') }} title={`${p.name} 위치로 이동`}>
        <span className="placeStoryRing"><MapPin size={22} /></span>
        <strong>{p.name}</strong>
        <small>#{p.tag}</small>
      </button>)}
    </div> : <p className="emptyState">아직 추가된 장소가 없어요.</p>
  }

  return <div ref={roomLayoutRef} className={`${chatOpen ? 'room' : 'room chatCollapsed'} mobile-${mobileView}`} style={{ '--chat-width': `${chatWidth}px` }}>
    <aside className="roomList">
      <div className="roomListTop">
        <div className="brandLockup"><span><MapPin size={18} /></span><b>어디가지</b></div>
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
    </aside>
    <main className="mapArea" ref={mapAreaRef}>
      <section className="mobileMapTop">
        <header className="sideHeader">
          <div>
            <h2>{session.roomName}{isOwner && <Crown className="ownerTitleIcon" size={15} />}</h2>
            <p>{members.length}명 · 저장된 장소 {places.length}곳</p>
          </div>
          <div className="toolbarActions">
            <button className="iconButton" onClick={() => setMembersOpen(true)} title="함께 있는 사람"><Users size={21} /></button>
            <button className="iconButton danger" onClick={() => setLeaveConfirmOpen(true)} title="나가기"><LogOut size={21} /></button>
          </div>
        </header>
        <section className="places">
          <b>추가된 장소</b>
          {renderPlaceStories()}
        </section>
      </section>
      <div className="mapSearch">
        <div className="searchBox">
          <Search size={20} />
          <input placeholder="장소 검색 예: 오사카 맛집" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPlaces()} />
          {search && <button className="clearSearch" onClick={() => { setSearch(''); setResults([]); setSelectedPlace(null) }} title="검색어 지우기"><X size={18} /></button>}
          <button onClick={searchPlaces}>검색</button>
        </div>
        {results.length > 0 && <div className="results">
          {results.map(r => <button key={r.id} onClick={() => { setSelectedPlace(r); setResults([]) }}><b>{r.place_name}</b><span>{r.road_address_name || r.address_name}</span></button>)}
        </div>}
      </div>
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
            <button className="iconButton" onClick={() => setChatOpen(false)} title="채팅 접기"><PanelRightClose size={21} /></button>
            <button className="iconButton danger" onClick={() => setLeaveConfirmOpen(true)} title="나가기"><LogOut size={21} /></button>
          </div>
        </header>
        <section className="places">
          <b>추가된 장소</b>
          {renderPlaceStories()}
        </section>
        <section className="chat">{messages.length > 0 ? messages.map(m => {
          const placeMessage = m.type === 'place_comment' ? parsePlaceMessage(m) : null
          if (placeMessage) {
            return <div key={m.id} className="system msg placeMessage">
              <b>알림</b>
              <p>{placeMessage.username}님이 {placeMessage.placeName}에 댓글을 남겼어요.</p>
              <button onClick={() => openPlaceFromMessage(placeMessage.placeId)}>확인하러 가기</button>
            </div>
          }
          return <div key={m.id} className={m.type === 'system' ? 'system msg' : 'msg'}><b>{m.username}</b><p>{m.content}</p></div>
        }) : <div className="emptyChat">아직 채팅이 없어요.</div>}</section>
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
    {roomManagerOpen && <div className="modalBackdrop" onClick={() => setRoomManagerOpen(false)}>
      <div className="roomManagerModal" onClick={e => e.stopPropagation()}>
        <div className="modalHead">
          <div>
            <b>방 추가</b>
            <span>{session.username}님이 참여할 방을 관리해요.</span>
          </div>
          <button className="iconButton" onClick={() => setRoomManagerOpen(false)} title="닫기"><X size={20} /></button>
        </div>
        <div className="tabs compact" role="tablist">
          <button className={roomMode === 'find' ? 'active' : ''} onClick={() => { setRoomMode('find'); setRoomError('') }}>방 찾기</button>
          <button className={roomMode === 'create' ? 'active' : ''} onClick={() => { setRoomMode('create'); setRoomError('') }}>방 만들기</button>
        </div>
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
          {roomMode === 'create' && <label><span>방 이름</span><input maxLength={MAX_NAME_LENGTH} placeholder="예: 제주 어디가지" value={roomForm.roomName} onChange={e => setRoomForm({ ...roomForm, roomName: e.target.value })} /></label>}
          <label><span>비밀번호</span><input placeholder="방 비밀번호" type="password" value={roomForm.password} onChange={e => setRoomForm({ ...roomForm, password: e.target.value })} /></label>
        </div>
        {roomError && <div className="error">{roomError}</div>}
        <button className="primary modalPrimary" disabled={roomLoading} onClick={() => roomMode === 'create' ? createRoomFromManager() : joinRoomFromManager(selectedJoinRoom)}>
          {roomLoading ? '처리 중...' : roomMode === 'create' ? '방 만들고 이동' : '방 입장하기'}
        </button>
      </div>
    </div>}
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
