(function () {
  const specs = {'DJI Neo':28.8,'DJI Flip':38.5,'DJI Mini 2 SE':38.5,'DJI Mini 3':38.5,'DJI Mini 3 Pro':38.5,'DJI Mini 4 Pro':38.5,'DJI Mini 5 Pro':43.2,'DJI Air 2S':38.5,'DJI Air 3':43.2,'DJI Air 3S':43.2,'DJI Mavic 3 Classic':43.2,'DJI Mavic 3':43.2,'DJI Mavic 3 Cine':43.2,'DJI Mavic 3 Pro':43.2,'DJI Mavic 4 Pro':43.2,'DJI Avata':38.5,'DJI Avata 2':38.5,'DJI Avata 360':38.5,'DJI Inspire 3':50.4,'DJI Matrice 30':54,'DJI Matrice 30T':54,'DJI Matrice 350 RTK':43.2,'DJI Matrice 4E':43.2,'DJI Matrice 4T':43.2,'DJI Matrice 4D':43.2,'DJI Matrice 4TD':43.2,'FIMI X8 Mini V2':38.5,'FIMI X8 SE 2022':43.2,'FIMI X8 Tele Max':43.2};
  const $ = id => document.getElementById(id);
  let weather, place = {lat:Number(localStorage.getItem('dronehub_lat')) || -22.9068, lon:Number(localStorage.getItem('dronehub_lon')) || -43.1729, name:localStorage.getItem('dronehub_location_name') || 'Rio de Janeiro, RJ'};
  const today = new Date(); const dateText = d => d.toISOString().slice(0,10);

  function addContext() {
    const main=document.querySelector('.main'); if(!main || $('flightContext')) return;
    main.classList.add('flight-deck');
    const cards=main.querySelectorAll(':scope > .card:not(:has(.dji-table))');
    if(cards[0]) cards[0].classList.add('aircraft-card');
    if(cards[1]) {
      cards[1].classList.add('conditions-card');
      const header=cards[1].querySelector('.card-header');
      if(header && !cards[1].querySelector('.conditions-intro')) header.insertAdjacentHTML('afterend','<div class="conditions-intro"><span>DECISÃO DE VOO</span><strong>Leitura local em tempo real</strong><small>Clima, aeronave e data selecionada reunidos em uma única avaliação.</small></div>');
    }
    const max=new Date(today); max.setDate(max.getDate()+3);
    const el=document.createElement('section'); el.id='flightContext'; el.className='flight-context';
    el.innerHTML='<div class="flight-context__panel"><div class="flight-context__eyebrow">Local da operação</div><div class="flight-context__title">Consulte qualquer cidade do Brasil</div><p class="flight-context__copy">Digite a cidade da missão e escolha hoje ou até três dias à frente. A previsão é do local; a aeronave é usada apenas na avaliação de voo.</p><div style="display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:14px"><input id="flightLocation" value="'+place.name+'" aria-label="Cidade da operação" placeholder="Cidade, UF"><button id="searchLocation" class="btn btn-primary" type="button">Consultar</button></div></div><div class="flight-context__panel"><div class="flight-context__eyebrow">Data da operação</div><div class="flight-context__title" id="weatherStamp">Consultando clima</div><label style="margin-top:14px">Previsão para</label><input id="flightDate" type="date" min="'+dateText(today)+'" max="'+dateText(max)+'" value="'+dateText(today)+'"><p class="flight-context__copy" style="margin-top:10px">Dados online atualizados automaticamente enquanto a Central estiver aberta.</p></div>';
    main.insertBefore(el, main.querySelector('.card'));
    const forecast=document.createElement('section'); forecast.className='flight-forecast'; forecast.innerHTML='<div class="flight-context__eyebrow">JANELA OPERACIONAL · 96H</div><div class="flight-forecast__heading"><div class="flight-context__title">Hoje e próximos 3 dias</div><span>Escolha a data da missão para ver o risco</span></div><div id="forecastGrid" class="forecast-grid" aria-live="polite"></div>';
    main.insertBefore(forecast, el.nextSibling);
    $('searchLocation').addEventListener('click', geocode);
    $('flightLocation').addEventListener('keydown', e => {if(e.key==='Enter') geocode();});
    $('flightDate').addEventListener('change', render);
  }
  function prepareAircraft(){
    const select=$('droneSelect'); if(!select) return;
    select.innerHTML='<option value="">Selecione sua aeronave</option>'+Object.keys(specs).map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'<option value="custom">Outro modelo — informar limite</option>';
    const grid=select.closest('.grid-2'), wrap=document.createElement('div'); wrap.id='manualLimitWrap'; wrap.className='manual-limit';
    wrap.innerHTML='<label for="manualWindLimit">Limite de vento do fabricante (km/h)</label><input id="manualWindLimit" type="number" min="1" step="0.1" placeholder="Ex.: 38,5"><small>Informe a especificação oficial do equipamento. O valor é salvo somente neste navegador.</small>';
    grid.parentNode.appendChild(wrap); select.addEventListener('change',()=>{wrap.classList.toggle('is-visible',select.value==='custom');render();});
    $('manualWindLimit').value=localStorage.getItem('dronehub_custom_wind_limit')||'';
    $('manualWindLimit').addEventListener('input',()=>{localStorage.setItem('dronehub_custom_wind_limit',$('manualWindLimit').value);render();});
  }
  function windLimit(){const key=$('droneSelect').value; return key==='custom'?Number($('manualWindLimit').value):specs[key];}
  function state(pct){return pct<=.6?['green','Condições favoráveis']:pct<=.8?['amber','Atenção: opere com cautela']:pct<=1?['orange','Alto risco operacional']:['red','Voo não recomendado'];}
  function selectedForecast(){const idx=weather.daily.time.indexOf($('flightDate').value); return {index:idx<0?0:idx, date:weather.daily.time[idx<0?0:idx]};}
  function renderForecast(){const grid=$('forecastGrid'); if(!grid||!weather)return; grid.innerHTML=weather.daily.time.map((day,i)=>{const gust=Math.round(weather.daily.wind_gusts_10m_max[i]),rain=Math.round(weather.daily.precipitation_probability_max[i]||0),risk=rain>=70||gust>=40?'risk-high':rain>=40||gust>=28?'risk-medium':'risk-low';return '<button type="button" class="weather-item forecast-card '+risk+'" data-day="'+day+'"><strong>'+new Date(day+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})+'</strong><span>Vento <b>'+Math.round(weather.daily.wind_speed_10m_max[i])+'</b> km/h</span><span>Rajadas <b>'+gust+'</b> km/h</span><span>Chuva <b>'+rain+'%</b></span></button>';}).join('');Array.from(grid.querySelectorAll('[data-day]')).forEach(btn=>btn.addEventListener('click',()=>{$('flightDate').value=btn.dataset.day;render();}));}
  function render(){
    if(!weather)return; const f=selectedForecast(), lim=windLimit(), forecastWind=weather.daily.wind_speed_10m_max[f.index], forecastGust=weather.daily.wind_gusts_10m_max[f.index], worst=Math.max(forecastWind,forecastGust), pct=lim?worst/lim:0, result=lim?state(pct):['amber','Selecione uma aeronave'];
    $('weatherLoading').style.display='none'; $('weatherContent').style.display='block';
    $('weatherGrid').innerHTML='<div class="weather-item"><div class="val">'+Math.round(weather.current.temperature_2m)+'°C</div><div class="lbl">Agora em '+place.name+'</div></div><div class="weather-item"><div class="val">'+Math.round(weather.current.wind_speed_10m)+' km/h</div><div class="lbl">Vento atual</div></div><div class="weather-item"><div class="val">'+Math.round(weather.current.wind_gusts_10m)+' km/h</div><div class="lbl">Rajada atual</div></div><div class="weather-item"><div class="val">'+weather.current.relative_humidity_2m+'%</div><div class="lbl">Umidade atual</div></div>';
    const badge=$('statusBadge'); badge.className='status-badge '+result[0]; badge.textContent=result[1];
    $('avaliacaoTexto').textContent=lim?'Previsão para '+new Date(f.date+'T12:00:00').toLocaleDateString('pt-BR')+' em '+place.name+': vento máximo de '+Math.round(forecastWind)+' km/h e rajadas de '+Math.round(forecastGust)+' km/h. Para '+$('droneSelect').value+', o limite cadastrado é '+lim+' km/h; a pior leitura prevista representa '+Math.round(pct*100)+'% desse limite.':'Escolha uma aeronave cadastrada ou informe o limite de vento do fabricante para receber a avaliação da data selecionada.';
    $('weatherStamp').textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); renderForecast();
  }
  function load(){
    $('weatherLoading').style.display='block';
    fetch('https://api.open-meteo.com/v1/forecast?latitude='+place.lat+'&longitude='+place.lon+'&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m&daily=wind_speed_10m_max,wind_gusts_10m_max,precipitation_probability_max&forecast_days=4&timezone=auto').then(r=>r.json()).then(data=>{weather=data;render();}).catch(()=>{$('weatherLoading').textContent='Não foi possível atualizar o clima agora. Tente novamente em instantes.';});
  }
  function geocode(){
    const query=$('flightLocation').value.trim(); if(!query)return;
    $('searchLocation').disabled=true; $('searchLocation').textContent='Buscando…';
    fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(query)+'&count=1&language=pt&format=json').then(r=>r.json()).then(data=>{if(!data.results||!data.results[0])throw Error('local'); const x=data.results[0]; place={lat:x.latitude,lon:x.longitude,name:x.name+(x.admin1?', '+x.admin1:'')}; localStorage.setItem('dronehub_lat',place.lat);localStorage.setItem('dronehub_lon',place.lon);localStorage.setItem('dronehub_location_name',place.name);$('flightLocation').value=place.name;load();}).catch(()=>{alert('Local não encontrado. Tente “Cidade, UF”.');}).finally(()=>{$('searchLocation').disabled=false;$('searchLocation').textContent='Consultar';});
  }
  document.addEventListener('DOMContentLoaded',()=>{addContext();prepareAircraft();load();setInterval(load,10*60*1000);});
}());
