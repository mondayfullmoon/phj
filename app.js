// Data Models
// children: [{ id, name, birthDate, therapistName, basePrevSessions: Number, createdAt }]
// records: [{ id, childId, date (YYYY-MM-DD), time, content, parentConsulted: Boolean, createdAt }]

const app = {
    children: [],
    records: [],
    currentChildId: null,
    currentRecordId: null,

    // Initializer
    init() {
        this.loadData();
        this.renderChildList();
        
        // Set default month to current
        document.getElementById('record-month-picker').value = new Date().toISOString().slice(0, 7);
    },

    // --- State Management ---
    loadData() {
        this.children = JSON.parse(localStorage.getItem('therapy_children') || '[]');
        this.records = JSON.parse(localStorage.getItem('therapy_records') || '[]');
    },
    saveData() {
        localStorage.setItem('therapy_children', JSON.stringify(this.children));
        localStorage.setItem('therapy_records', JSON.stringify(this.records));
    },

    // --- Data Sync (Export / Import) ---
    exportData() {
        const filterSelect = document.getElementById('filter-therapist');
        const therapistFilter = filterSelect ? filterSelect.value : '';

        // 필터가 설정되어 있으면 해당 치료사의 아동만 추출, 아니면 전체 아동
        let targetChildren = this.children;
        if (therapistFilter) {
            targetChildren = this.children.filter(c => c.therapist === therapistFilter);
        }

        // 추출된 아동들의 ID 목록을 바탕으로, 해당 아동들의 치료 기록만 추출
        const targetChildIds = targetChildren.map(c => c.id);
        const targetRecords = this.records.filter(r => targetChildIds.includes(r.childId));

        const data = { children: targetChildren, records: targetRecords };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        
        // 파일 이름에 치료사 역할 명시
        const prefix = therapistFilter ? `${therapistFilter}_` : '전체_';
        downloadAnchorNode.setAttribute("download", `${prefix}치료일지데이터_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        if (therapistFilter) {
            alert(`[${therapistFilter}] 전용 데이터 파일이 생성되었습니다.\n이 파일에는 타 치료사의 아동 정보가 포함되어 있지 않습니다.\n해당 파일만 선생님에게 배포하시면 됩니다.`);
        } else {
            alert("전체 데이터 파일(.json) 다운로드가 완료되었습니다.\n이 파일을 원장님(또는 관리자)에게 메신저로 전달하세요.");
        }
    },

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (importedData.children && importedData.records) {
                    let newChildrenCount = 0;
                    let newRecordsCount = 0;

                    importedData.children.forEach(ic => {
                        if (!this.children.find(c => c.id === ic.id)) {
                            this.children.push(ic);
                            newChildrenCount++;
                        }
                    });

                    importedData.records.forEach(ir => {
                        if (!this.records.find(r => r.id === ir.id)) {
                            this.records.push(ir);
                            newRecordsCount++;
                        }
                    });

                    this.saveData();
                    this.renderChildList();
                    alert(`✅ 데이터 취합 성공!\n새로운 아동 ${newChildrenCount}명, 진행 기록 ${newRecordsCount}건이 새로 취합되었습니다.`);
                } else {
                    alert('올바른 백업 파일(JSON) 형식이 아닙니다.');
                }
            } catch (err) {
                alert('파일을 읽는 도중 오류가 발생했습니다.');
            }
            event.target.value = ''; // Reset
        };
        reader.readAsText(file);
    },

    // --- Navigation & UI ---
    navigate(view, childId = null) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        if (view === 'home') {
            document.getElementById('view-home').classList.remove('hidden');
            this.currentChildId = null;
            this.renderChildList();
        } else if (view === 'detail' && childId) {
            document.getElementById('view-detail').classList.remove('hidden');
            this.currentChildId = childId;
            this.renderChildDetail();
            this.loadRecords();
        }
    },

    showAddChildModal() {
        document.getElementById('form-add-child').reset();
        document.getElementById('modal-add-child').classList.remove('hidden');
    },
    showAddRecordModal() {
        document.getElementById('form-add-record').reset();
        document.getElementById('input-record-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-add-record').classList.remove('hidden');
    },
    closeModal(modalId) {
        document.getElementById(modalId).classList.add('hidden');
    },

    // --- Children Logic ---
    saveChild() {
        const id = Date.now().toString();
        const child = {
            id,
            name: document.getElementById('input-child-name').value,
            birthDate: document.getElementById('input-child-birth').value,
            therapistName: document.getElementById('input-child-therapist').value,
            basePrevSessions: parseInt(document.getElementById('input-child-prev-sessions').value, 10),
            createdAt: new Date().toISOString()
        };
        this.children.push(child);
        this.saveData();
        this.closeModal('modal-add-child');
        this.renderChildList();
    },

    calculateAge(birthDate) {
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    },

    renderChildList() {
        const grid = document.getElementById('child-grid');
        const filterSelect = document.getElementById('filter-therapist');
        const selectedTherapist = filterSelect.value;
        
        // Update Filter Options
        const therapists = [...new Set(this.children.map(c => c.therapistName))];
        
        // Retain the current selection while updating options
        let optionsHtml = `<option value="ALL">모든 치료사 보기</option>`;
        therapists.forEach(t => {
            optionsHtml += `<option value="${t}" ${t === selectedTherapist ? 'selected' : ''}>${t}</option>`;
        });
        filterSelect.innerHTML = optionsHtml;

        grid.innerHTML = '';
        
        const filteredChildren = selectedTherapist === "ALL" 
            ? this.children 
            : this.children.filter(c => c.therapistName === selectedTherapist);

        filteredChildren.forEach(child => {
            const age = this.calculateAge(child.birthDate);
            const childRecords = this.records.filter(r => r.childId === child.id);
            const total = child.basePrevSessions + childRecords.length;
            
            const card = document.createElement('div');
            card.className = 'child-card';
            card.onclick = () => this.navigate('detail', child.id);
            card.innerHTML = `
                <h3>${child.name}</h3>
                <p>치료사: ${child.therapistName} | 나이: 만 ${age}세</p>
                <div class="tags">
                    <span class="tag">총 ${total}회</span>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    renderChildDetail() {
        const child = this.children.find(c => c.id === this.currentChildId);
        if (!child) return;
        const age = this.calculateAge(child.birthDate);
        
        document.getElementById('detail-info-content').innerHTML = `
            <div class="info-item"><span class="info-label">아동 성명</span><span class="info-value">${child.name}</span></div>
            <div class="info-item"><span class="info-label">생년월일 (나이)</span><span class="info-value">${child.birthDate} (만 ${age}세)</span></div>
            <div class="info-item"><span class="info-label">치료사명</span><span class="info-value">${child.therapistName}</span></div>
            <div class="info-item"><span class="info-label">등록 시점 누계회차</span><span class="info-value">${child.basePrevSessions}회</span></div>
        `;
    },

    showEditChildModal() {
        const child = this.children.find(c => c.id === this.currentChildId);
        if (!child) return;
        document.getElementById('edit-child-name').value = child.name;
        document.getElementById('edit-child-birth').value = child.birthDate;
        document.getElementById('edit-child-therapist').value = child.therapistName;
        document.getElementById('edit-child-prev-sessions').value = child.basePrevSessions;
        document.getElementById('modal-edit-child').classList.remove('hidden');
    },

    updateChild() {
        const childIndex = this.children.findIndex(c => c.id === this.currentChildId);
        if (childIndex === -1) return;
        
        this.children[childIndex].name = document.getElementById('edit-child-name').value;
        this.children[childIndex].birthDate = document.getElementById('edit-child-birth').value;
        this.children[childIndex].therapistName = document.getElementById('edit-child-therapist').value;
        this.children[childIndex].basePrevSessions = parseInt(document.getElementById('edit-child-prev-sessions').value, 10);
        
        this.saveData();
        this.closeModal('modal-edit-child');
        this.renderChildDetail();
        this.renderChildList();
    },

    deleteChild() {
        if (!confirm("정말 이 아동의 모든 기록을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")) {
            return;
        }
        this.children = this.children.filter(c => c.id !== this.currentChildId);
        this.records = this.records.filter(r => r.childId !== this.currentChildId);
        this.saveData();
        this.closeModal('modal-edit-child');
        this.navigate('home');
    },

    // --- Records Logic ---
    saveRecord() {
        if (!this.currentChildId) return;
        const record = {
            id: Date.now().toString(),
            childId: this.currentChildId,
            date: document.getElementById('input-record-date').value,
            time: document.getElementById('input-record-time').value,
            content: document.getElementById('input-record-content').value,
            parentContent: document.getElementById('input-record-parent-content').value,
            etcContent: document.getElementById('input-record-etc-content').value,
            createdAt: new Date().toISOString()
        };
        this.records.push(record);
        this.saveData();
        this.closeModal('modal-add-record');
        this.loadRecords();
    },

    deleteRecord(recordId) {
        if (!confirm("해당 치료 기록을 삭제하시겠습니까?")) return;
        this.records = this.records.filter(r => r.id !== recordId);
        this.saveData();
        this.loadRecords();
        this.renderChildList();
    },

    showEditRecordModal(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;
        this.currentRecordId = recordId;
        document.getElementById('edit-record-date').value = record.date;
        document.getElementById('edit-record-time').value = record.time;
        document.getElementById('edit-record-content').value = record.content;
        document.getElementById('edit-record-parent-content').value = record.parentContent || '';
        document.getElementById('edit-record-etc-content').value = record.etcContent || '';
        document.getElementById('modal-edit-record').classList.remove('hidden');
    },

    updateRecord() {
        if (!this.currentRecordId) return;
        const index = this.records.findIndex(r => r.id === this.currentRecordId);
        if (index === -1) return;
        
        this.records[index].date = document.getElementById('edit-record-date').value;
        this.records[index].time = document.getElementById('edit-record-time').value;
        this.records[index].content = document.getElementById('edit-record-content').value;
        this.records[index].parentContent = document.getElementById('edit-record-parent-content').value;
        this.records[index].etcContent = document.getElementById('edit-record-etc-content').value;
        
        this.saveData();
        this.closeModal('modal-edit-record');
        this.loadRecords();
    },

    showAutoScheduleModal() {
        if (!this.currentChildId) return;
        const currentMonthVal = document.getElementById('record-month-picker').value;
        const today = new Date();
        const defaultMonth = currentMonthVal || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        
        document.getElementById('auto-schedule-month').value = defaultMonth;
        document.getElementById('modal-auto-schedule').classList.remove('hidden');
    },

    generateAutoSchedule() {
        if (!this.currentChildId) return;
        
        const monthStr = document.getElementById('auto-schedule-month').value; // YYYY-MM
        const weekdayStr = document.getElementById('auto-schedule-weekday').value; // 0~6
        const timeStr = document.getElementById('auto-schedule-time').value;

        if (!monthStr || !weekdayStr || !timeStr) return;

        const [yyyy, mm] = monthStr.split('-');
        const year = parseInt(yyyy);
        const monthZeroIndexed = parseInt(mm) - 1;
        const targetDayOfWeek = parseInt(weekdayStr);

        // Get number of days in the requested month
        const daysInMonth = new Date(year, monthZeroIndexed + 1, 0).getDate();
        
        let createdCount = 0;
        let duplicateCount = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, monthZeroIndexed, day);
            if (dateObj.getDay() === targetDayOfWeek) {
                // Found a matching weekday! Format: YYYY-MM-DD
                const fullDateStr = `${year}-${String(monthZeroIndexed + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Check if this date already has a session for this child
                const exists = this.records.some(r => r.childId === this.currentChildId && r.date === fullDateStr);
                
                if (!exists) {
                    const record = {
                        id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        childId: this.currentChildId,
                        date: fullDateStr,
                        time: timeStr,
                        content: '', // Empty content waiting for the teacher to fill after session
                        parentContent: '',
                        etcContent: '',
                        createdAt: new Date().toISOString()
                    };
                    this.records.push(record);
                    createdCount++;
                } else {
                    duplicateCount++;
                }
            }
        }

        if (createdCount > 0) {
            this.saveData();
            // Optional: Auto switch the month picker to the generated month so they see the result immediately
            document.getElementById('record-month-picker').value = monthStr;
            this.loadRecords();
            alert(`✅ ${createdCount}개의 스케줄이 성공적으로 자동 생성되었습니다!${duplicateCount > 0 ? `\n(이미 등록된 ${duplicateCount}개 날짜는 건너뛰었습니다.)` : ''}`);
        } else {
            if (duplicateCount > 0) {
                alert(`이미 해당 요일의 모든 날짜에 스케줄이 등록되어 있습니다. (${duplicateCount}개)`);
            } else {
                alert(`해당 월에 요일이 올바르지 않습니다.`);
            }
        }

        this.closeModal('modal-auto-schedule');
    },

    loadRecords() {
        if (!this.currentChildId) return;
        const monthStr = document.getElementById('record-month-picker').value; // YYYY-MM
        const list = document.getElementById('records-list');
        list.innerHTML = '';

        const monthRecords = this.records.filter(r => r.childId === this.currentChildId && r.date.startsWith(monthStr))
                                .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (monthRecords.length === 0) {
            list.innerHTML = `<div class="record-empty">해당 월에 등록된 치료 기록이 없습니다.</div>`;
            return;
        }

        monthRecords.forEach((r, idx) => {
            const el = document.createElement('div');
            el.className = 'record-item';
            el.innerHTML = `
                <div class="record-meta" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>${r.date} (${r.time})</span>
                        <span style="font-size: 0.85rem;">${r.parentContent && r.parentContent.trim() !== '' ? '👥 부모상담 포함' : ''}</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; color: #3b82f6;" onclick="app.showEditRecordModal('${r.id}')">수정</button>
                        <button class="btn-ghost" style="padding: 4px 8px; font-size: 0.8rem; color: #ef4444;" onclick="app.deleteRecord('${r.id}')">삭제</button>
                    </div>
                </div>
                <div class="record-content">
                    <div style="margin-bottom: 8px;"><strong>[치료 내용]</strong><br>${r.content}</div>
                    ${r.parentContent && r.parentContent.trim() !== '' ? `<div style="border-top: 1px dashed var(--primary-light); padding-top: 8px;"><strong>[부모 상담]</strong><br>${r.parentContent}</div>` : ''}
                    ${r.etcContent && r.etcContent.trim() !== '' ? `<div style="border-top: 1px dashed var(--primary-light); padding-top: 8px;"><strong>[기타 사항]</strong><br>${r.etcContent}</div>` : ''}
                </div>
            `;
            list.appendChild(el);
        });
    },

    // --- PDF Generation Logic ---
    generatePDF() {
        const child = this.children.find(c => c.id === this.currentChildId);
        const monthStr = document.getElementById('record-month-picker').value; // YYYY-MM
        if (!child || !monthStr) return;

        // Calculate Sessions
        const selectedMonthDate = new Date(monthStr + '-01');
        
        let olderRecordsCount = 0;
        let currentMonthRecordsCount = 0;
        
        let monthRecords = [];

        this.records.forEach(r => {
            if (r.childId !== child.id) return;
            const rDate = new Date(r.date);
            // Check if older than selected month
            if (rDate.getFullYear() < selectedMonthDate.getFullYear() || 
               (rDate.getFullYear() === selectedMonthDate.getFullYear() && rDate.getMonth() < selectedMonthDate.getMonth())) {
                olderRecordsCount++;
            } else if (r.date.startsWith(monthStr)) {
                currentMonthRecordsCount++;
                monthRecords.push(r);
            }
        });

        // Sort by date ascending
        monthRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

        const prevMonthAccumulated = child.basePrevSessions + olderRecordsCount;
        const totalAccumulated = prevMonthAccumulated + currentMonthRecordsCount;

        // 1. Fill Info Table
        const age = this.calculateAge(child.birthDate);
        document.getElementById('pdf-name').innerText = child.name;
        document.getElementById('pdf-age').innerHTML = `${child.birthDate}<br>(만 ${age}세)`;
        document.getElementById('pdf-therapist').innerText = child.therapistName;
        document.getElementById('pdf-prev-sessions').innerText = prevMonthAccumulated + '회';
        document.getElementById('pdf-total-sessions').innerText = totalAccumulated + '회';

        // 2. Fill Records Table
        const tbody = document.getElementById('pdf-records-body');
        tbody.innerHTML = '';
        
        if (monthRecords.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 20px;">기록이 없습니다.</td></tr>`;
        }

        monthRecords.forEach((r, idx) => {
            const dateObj = new Date(r.date);
            const days = ['일','월','화','수','목','금','토'];
            const dayName = days[dateObj.getDay()];
            const [y, m, d] = r.date.split('-');
            
            // Format time string
            // Assuming time is provided like "14:00~14:50" or "14:00 - 15:00"
            const timeStr = r.time; 

            // Current Session number over the entire lifetime
            const currentSessionNumber = prevMonthAccumulated + idx + 1;
            const parentText = r.parentContent && r.parentContent.trim() !== '' ? r.parentContent : '없음';
            const etcDisplayHtml = r.etcContent && r.etcContent.trim() !== '' ? `* 기타 : ${r.etcContent}` : '';

            const tr = document.createElement('tr');
            tr.style.pageBreakInside = 'avoid';
            tr.innerHTML = `
                <td class="pdf-record-num" style="vertical-align: top; padding-top: 15px;">
                    <div style="font-weight: bold; font-size: 15px; margin-bottom: 20px;">${currentSessionNumber}회</div>
                    <div style="font-weight: normal; font-size: 13px; color: black; line-height: 1.6; white-space: nowrap; letter-spacing: -0.5px;">
                        ${y}.${m}.${d} (${dayName})<br>
                        ${timeStr}
                    </div>
                </td>
                <td style="vertical-align: top;">
                    <div style="margin-bottom:12px; min-height: 40px;">${r.content}</div>
                    <div style="color: black;">
                        * 부모상담 : ${parentText}
                        ${etcDisplayHtml ? `<div style="margin-top: 4px;">${etcDisplayHtml}</div>` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // 3. Generate PDF
        const element = document.getElementById('pdf-template');
        element.style.display = 'block'; // Make it visible for capture

        const opt = {
            margin:       0,
            filename:     `${child.name}_치료일지_${monthStr}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: 'css', avoid: 'tr' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.parentElement.style.display = 'none';
            app.renderChildList();
        });
    },

    generateConfirmationPDF() {
        if (!this.currentChildId) return;
        const child = this.children.find(c => c.id === this.currentChildId);
        if (!child) return;

        const monthStr = document.getElementById('record-month-picker').value;
        if (!monthStr) {
            alert('출력할 월을 먼저 선택하세요.');
            return;
        }

        const [yyyy, mm] = monthStr.split('-');
        
        let programName = "놀이심리";
        const tname = child.therapist || '';
        if (tname.includes("미술")) programName = "미술심리";
        else if (tname.includes("언어")) programName = "언어치료";

        document.getElementById('pdf-conf-title').innerText = `아동·청소년심리지원서비스 ${parseInt(mm)}월 ${programName} 프로그램 상담 확인표`;
        
        let ageOrDob = child.dob || '생년월일없음'; 
        if (ageOrDob && ageOrDob.includes('-')) {
            const parts = ageOrDob.split('-');
            ageOrDob = parts[0].slice(-2) + parts[1] + parts[2];
        }
        document.getElementById('pdf-conf-name').innerText = `${child.name}(${ageOrDob})`;

        const childRecords = this.records
            .filter(r => r.childId === child.id)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let prevMonthAccumulated = parseInt(child.prevSessions || '0');
        let monthRecords = [];

        for (let i = 0; i < childRecords.length; i++) {
            const r = childRecords[i];
            if (r.date.startsWith(monthStr)) {
                monthRecords.push({ record: r, sessionNum: prevMonthAccumulated + 1 });
            }
            prevMonthAccumulated++;
        }

        const tbody = document.getElementById('pdf-conf-tbody');
        tbody.innerHTML = '';

        for (let i = 1; i <= 10; i++) {
            const tr = document.createElement('tr');
            tr.style.pageBreakInside = 'avoid';
            
            if (i <= monthRecords.length) {
                const item = monthRecords[i - 1];
                const r = item.record;
                const dateObj = new Date(r.date);
                const mmObj = dateObj.getMonth() + 1;
                const ddObj = dateObj.getDate();
                
                tr.innerHTML = `
                    <td style="text-align: center; vertical-align: middle; height: 50px;">${i}</td>
                    <td style="text-align: center; vertical-align: middle;">${mmObj}.${ddObj}(${item.sessionNum}회)</td>
                    <td style="text-align: center; vertical-align: middle; letter-spacing: -0.5px;">${r.time}</td>
                    <td style="text-align: center; vertical-align: middle;"></td>
                    <td style="text-align: center; vertical-align: middle;"></td>
                `;
            } else {
                tr.innerHTML = `
                    <td style="text-align: center; vertical-align: middle; height: 50px;">${i}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                `;
            }
            tbody.appendChild(tr);
        }

        const element = document.getElementById('pdf-confirmation-template');
        element.parentElement.style.display = 'block';

        const opt = {
            margin:       10,
            filename:     `${child.name}_상담확인표_${monthStr}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            element.parentElement.style.display = 'none';
        });
    }
};

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
