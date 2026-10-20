# R1–R6＋统一 UI 集成验证

## 当前范围

2026-10-20，Asia/Shanghai。串行实施，R6固定在`e20bf06f95b0dcfec6d24a8a9e4d8abbc0a61285`。
Task1来源保护与Task2独立环境已完成；Task3合流、迁移及认证兼容、Task4的UI增量处置已完成；Task5视觉适配正在验收。最终全量门禁、独立评审和远端CI尚未完成。
以下是开发检查点证据，不是最终整合版的功能验收或交付结论。

## 来源与资源

- 四棵来源树均保存HEAD/分支/索引、暂存与未暂存binary patch及未跟踪文件；外部还原副本的porcelain-z、两份patch及index哈希均一致。最新源树复核仍无差异。
- 主树4份未跟踪文档；R5干净；UI298条未提交路径、54条已暂存；R6/R7 tip为`4f7b7af`，16条未提交路径。源树不提交、不reset/stash、不运行来源runner。
- 初始集成HEAD为`e20bf06`，分支`codex/r1-r6-ui-integration`。应用工作树工具无法识别父目录仓库，已使用原生Git建立外部独立工作树；该目录不由应用托管。
- 已fetch并锁定main=`55cc27ed64ce8c5273648175a0f84775bf1ac718`、PR43 head=`b3adf14199e4a1074c9d01f719ff06cafd465390`；PR head和R5均为R6检查点祖先。原八个后续提交保留。
- 独立项目`campusquest-integration`；资源见`infra/integration/resources.json`。Web3311取代被旧ClamAV占用的3310；数据库`campusquest_test_integration`、PG16440、Redis6480、MinIO9135/9136、Clam3320、API8310均为本栈专用。
- 随机凭据、owner标记、证书、源快照索引和完整日志仅位于ignored runtime及仓库外快照目录，不进入PR。

## Task2当前证据

完整外层命令记录保存在本机外部`CampusQuestIntegrationSnapshots/execution-logs/`；wrapper内层日志保存在`infra/integration/.runtime/logs/`。每条外层JSON记录cwd、argv、起止、真实进程退出码及完整日志SHA256。

| 检查 | 结果和边界 | 本轮外层日志文件名 |
| --- | --- | --- |
| 资源拒绝 | 有效RED为4过8失败；补齐S3、E2E资源和owner检查后12过、零skip | `20261020T102213577982Z-isolation-red-2.log`；`20261020T102409735177Z-isolation-green.log` |
| 原子battery | 不支持battery时5项有效RED；修后成功、浏览器失败、guard失败、新报告及旧报告拒用5项全部通过 | `20261020T102224346735Z-battery-red-2.log`；`20261020T102423304063Z-battery-green.log` |
| 宿主归属 | 错owner标记真实RED（命令被执行）；修后错owner及真实错mount均在manifest/命令执行前拒绝，原marker字节恢复 | `20261020T102506839111Z-host-source-red.log`；`20261020T102623228624Z-host-source-green.log` |
| 串行锁 | node/tsx两个wrapper子进程实际时间区间不重叠 | `20261020T102721561318Z-runner-lock-proof.log` |
| 参数和exit7 | 原probe完整argv通过，inner/launch/docker/PowerShell子进程均返回7；外层记录实际7。首次调用参数不全的失败保留 | `20261020T102821358170Z-wrapper-exit7-proof-2.log` |
| PG/Redis/S3/CORS | 真实PG/Redis、HTTP/TLS对象读写、证书信任、本栈origin允许和旧3000拒绝均通过 | `20261020T102932391946Z-runtime-smoke.log` |
| 真实ClamAV | 清洁文件、EICAR及10MiB末端威胁3项通过，无skip；仅本栈扫描器 | `20261020T103125565258Z-clamav-real-smoke.log` |
| 浏览器运行时 | 真Chromium、新context零cookie及页面渲染通过；不是完整产品旅程 | `20261020T103151829379Z-browser-runtime-smoke.log` |
| Playwright环境契约 | API server与world接收同一独立对象存储配置，均不复用旧服务，1项通过 | `20261020T103224525644Z-playwright-env-contract.log` |
| Git上下文 | private index与本次native tracked清单一致、TSX扫描完整、原`.git`指针未变 | `20261020T103533582936Z-git-context-proof.log` |
| 栈归属 | 实际Compose名称、端口、卷、source labels、容器owner及runner mount检查通过 | `20261020T103417618423Z-stack-ownership-check.log`；`20261020T103314224407Z-compose-contract-green.log` |
| 来源保护 | 四棵树的HEAD/分支/index/status及dirty文件哈希与成功快照一致 | `20261020T103512295629Z-source-preservation-task2.log` |

Task2时旧UI、R6、R7来源服务抽查均running，StartedAt早于本次集成，记录位于ignored `source-containers-task2.json`。随后WSL曾中断；经小叶明确授权重启后的恢复证据见下节。旧库、旧对象和凭据均未重建。

## Task3迁移及兼容检查点

锁定上游实际终点为`0032_invitation_revoked_at`，18份双创迁移依次映射至`ie_0025`–`ie_0042`。`migration-targets.json`记录来源与操作体契约。未修改上游DDL，也未增加空壳兼容迁移。

| 检查 | 实际结果 | 完整记录入口 |
|---|---|---|
| 迁移图 | 原始合流图5失败1通过；修复后6通过，上游文件和双创非metadata AST保持 | `20261020T104740887058Z-migration-graph-green-2.log` |
| probe目标保护 | 非归属/非测试URL在连接前拒绝；显式CI契约回归通过 | `20261020T110148268044Z-migration-target-guard-green.log` |
| M1空库 | 正确版本、结构和metadata通过，临时库归属核验后移除 | runtime `20261020T110245Z-98133b56/result.json` |
| M2上游数据 | 11条代表行的完整JSON及关键关系保持，升级/check通过 | runtime `20261020T110728Z-7dcd6217/result.json` |
| M3历史回填 | 创建者、导师历史、证明上传者/代次和不可变性通过 | runtime `20261020T110913Z-2931fbe3/result.json` |
| M4回退重升 | 回到上游时catalog和11行精确恢复，重升/check通过；base限制见下文 | runtime `20261020T111841Z-171bdb7e/result.json`；`20261020T111823918033Z-migration-path-m4-upstream-control.log` |
| base失败归因保护 | 必须与独立纯上游临时库的失败迁移、异常及SQL一致；不接受任意错误当原限制 | RED1失败8通过，GREEN9通过；`20261020T111749349347Z-migration-base-limit-green.log` |
| 角色导航 | 管理员原先误入teacher的2项真实失败已修复，导师隔离保留；账号校验合计32通过 | `20261020T112045845438Z-combined-workspace-auth-green.log` |
| 子域活动导航 | admin根精确匹配与独立运营排除同时保持；相关9项通过 | `20261020T112248268465Z-combined-navigation-green.log` |
| 认证API/迟响应与任务策略 | 统一挑战、导师API、refresh换号串行、任务通知和默认模板86项通过 | `20261020T112543927471Z-combined-auth-api-regression.log` |
| 前端类型 | 修复Windows下NicknameNudge/nicknameNudge模块解析碰撞及CampusShell显式会话参数后通过 | `20261020T113402575986Z-merged-frontend-typecheck-fixed.log` |
| 来源复核 | 四棵原树的HEAD、index、status及dirty文件字节均无漂移 | `20261020T113611263731Z-source-preservation-task3-mid.log` |

M4的base降级**没有成功**。原上游`0025 -> 0024`会把允许类型收窄为CSV/XLSX/SQLITE，含合法PDF任务时触发`ck_tasks_allowed_file_types`。本轮在另一纯上游新库插入同样代表数据，复现了相同操作、异常及SQL；集成新库的fresh rebuild→head/check另行通过。三份临时库均核对owner、run marker及名称后删除。早期未比对纯上游的宽松fallback记录已被该严格记录替代。

CI已增加M1–M4及完整工件上传，尚未远端执行。导师专属登录保留username/password，统一入口使用identifier；另修复导师借员工验证码或旧设备绕过专属入口的角色判断。真实PG导师与已有统一认证回归30项通过（`20261020T114237531560Z`）。完整受影响identity、core/innovation composition和真实ClamAV合计306项通过，零skip（`20261020T115010388221Z-task3-real-auth-composition.log`）。这是开发检查点，尚未达到最终冻结head的全量验收。

前端架构从1条真实错误修至0错误（`20261020T115000379430Z`），将跨层CampusShell组合放回app层；89条原warn级跨feature边未改规则或新增豁免。对应前端unit907项通过、零skip；后端focused unit175项通过；静态/格式/mypy/后端架构/33份矩阵检查通过（`20261020T114434004414Z`）。

## WSL中断及授权恢复

首次实际浏览器命令在服务启动期间失去WSL连接，未产生已接受的测试结果，外层`20261020T115313997524Z`最终exit1。小叶明确授权重启`CampusQuest-Dev`后，单独终止该发行版成功（`20261020T121221042847Z`），随后恢复原Docker daemon。

重启前已在仓库外保存未提交merge的原生index和完整binary patches。恢复24个本次崩溃退出的既有容器，所有容器ID、卷和挂载逐字段一致，仅Docker返回的mount列表按destination规范化排序；未重建容器、库、卷、证书或凭据。旧UI/R6/R7的PG、Redis、ClamAV均healthy，R5及旧evidence服务按原restart policy自行恢复。此前已经停止的历史容器和完成的init容器未启动。恢复记录为仓库外`wsl-recovery-20261020T121623Z.json`，完整命令`20261020T121621144065Z`。

来源保护复核`20261020T121644905019Z`exit0，四棵原树相对Task1全部零差异。新栈恢复smoke`20261020T121729181894Z`exit0，真实PG/Redis、HTTP/TLS对象读写、证书和CORS通过。原失败浏览器未留下本次的新world manifest；原镜像内2026-10-09/10的临时文件不作为本次world清理，原样保留；独立3311/8310均已空闲。

恢复后`20261020T121935406529Z-task3-post-recovery-contract-static-portable.log`exit0：契约重新生成SHA256不变，原生Git对两个文件`diff --exit-code`为0；typecheck、lint（1项原有unused Page warning）、CSS（6项candidate warning）和6项迁移图回归通过。初次恢复检查因精简镜像没有ss命令而失败，未进入后续门禁；改用Python socket探测后重跑，不把环境错误计为RED。

浏览器模式已固定RAYON_NUM_THREADS=2、Node heap768MiB，保留安装版本的默认Next bundler、所有断言、超时、阈值和mask。正式完整battery仍须在最终冻结环境重新执行。

## 环境版本与尚未执行项

合流新锁安装后重新记录：Python3.12.3、Node22.23.3、FastAPI0.141.1、Alembic1.20.0、SQLAlchemy2.0.54、Next16.4.0、React19.3.0、Playwright1.63.0、TypeScript6.0.3（`20261020T122328598171Z`）。真实启动的Chromium153.0.8010.12、Firefox155.0、WebKit26.6及入口文件SHA另存runtime metadata（`20261020T125814654350Z`）；不是跨浏览器产品验收。
Noto Sans/Serif CJK SC与Liberation Mono实际解析成功，字体文件SHA256保存于ignored runtime metadata；本轮已按合流锁安装并刷新，两个锁的SHA同时记录。

两次最初自证分别遇到WSL调用失败/尚未安装Python环境，不计为有效RED。首次Compose缺少Linux形式env-file路径、旧Compose测试未读取私有env的失败均保留。来源快照的两个换行归档失败保留，成功版本逐文件复核原始字节和mtime，而非用容差略过差异。

`npm ci`报告5项high风险；安装退出0不等于审计通过。后续须实际运行审计门禁并核对有效既有豁免。
截至I2，I1的M1–M4开发验证及UI逐路径对账已完成，base回退限制仍单列；最终冻结head下的真实组合全量、像素/无障碍/人工旅程、独立评审及远端CI尚未完成。不得引用旧R6/UI通过数字作为整合版证据。


## Task3补充回归与环境自证

- 完整默认M1–M4单次命令`20261020T122328598171Z`exit0；runtime迁移记录`20261020T122956Z-858e455b/result.json`。6份本次临时库全部核对归属后清理。M4仍明确base_roundtrip=false；同一原上游PDF约束错误被纯上游控制库复现，fresh rebuild另行通过。
- 教师无TOTP登录后的工作区/提交下载原先被旧管理守卫拒绝。按上游V1.1§2.1/2.3补7项真实失败后修复；管理员强制TOTP仍保留。5份实际身份/认证/角色集成测试95通过、零skip，`20261020T123531261773Z`。后续完整受影响认证/核心及双创composition/真实ClamAV复跑310项通过、零skip，`20261020T131326180300Z`。
- 已保存账号导致SSR/hydration不一致的浏览器回归先失败，复用现有mentor表单的client-ready规则后1项通过，`20261020T123405926704Z`→`20261020T123708797933Z`。没有用重填输入或忽略浏览器错误掩盖表单重建。
- 6500ms管理工作区加载回归先失败；修复共享fixture为已确认登录后等待导航，只有真实TOTP拒绝响应才重试。原6500ms和只提交一次断言均未变，`20261020T124031638306Z`→`20261020T124324018889Z`，1项通过、零skip。
- 修改后静态/格式610/mypy251/后端13架构契约/33矩阵/真实契约重新生成/前端类型/lint/CSS/907单测/前端架构均通过，`20261020T124458523410Z`。前端架构0error/89原warn级边，未放宽规则。随后新增I24与跨标签测试选择器，最后I1仍须检查对应更新。
- 宿主FENCE/PROBE两个显式开关原先未转发，实际接收均undefined的RED已保存。新增Boolean转发和标准battery的专门开关拒绝，宿主自证通过`20261020T130012067932Z`：专门运行均为1；标准battery在运行浏览器/改写报告之前exit2，原报告哈希不变。
- 7文件首轮为18通过/3失败/3专门开关skip（`20261020T124404461688Z`），完整报告已归档；三处失败是随机未知数字落入手机分支，以及两个学生退出用例仍寻找旧按钮。现在使用真实已种学生的错密码、真实退出链接→确认→POST204→完整登录文档；不恢复旧学生按钮或跳过确认。新一轮实际开启FENCE/PROBE得到23通过、1项旧账号栏CSS选择器失败、零skip；改用既有可访问名称“我的账户”并增加B身份正断言后，专门3项通过。随后正式runner完整24项一次通过，见下文。


## I1本阶段结项证据

正式 `run.ps1 playwright` 在新栈扫描器已恢复且healthy的环境，显式开启FENCE/PROBE，7个文件24项全部通过、零skip/零flaky，`20261020T132458860652Z-i1-formal-public-runner-auth-all-24.log`。完整新报告及SHA保存于runtime `focused-browser/formal-20261020T133147-0b1a5c27/result.json`，报告SHA256为`c7598adb923e7e58789cfa13e7bad1f2914fbb32e6764b744993a1e3f526e914`。这是I1兼容验收，不是最终H的整套battery或像素验收。

`20261020T131934187957Z-final-i1-updated-type-matrix-infra-checks.log`的12步均exit0：610文件格式、33份矩阵、最新前端type/lint、Bash语法、12项隔离、5项原子battery、自证串行不重叠、宿主错source/mount拒绝、专门开关转发及标准battery拒绝、Compose和实际资源归属。原生Git对两个重新生成契约文件diff为0。源码审计与四源保护记录`20261020T131556312988Z`/`20261020T131556305799Z`均通过；32份上游迁移blob完整、原8个提交保留、40个R7新增路径未进入索引、无未解决冲突。未更新受版本管理的PNG基线。

## Task4 UI来源对账与开发回归

[298路径逐项处置](ui-integration-disposition.md)以固定R6 `e20bf06`和I1 `1bf03a4`为比较点。原232相同/40差异/26缺失，经I1重新核对为173相同/95差异/30缺失；当前处置172已存在、20选择性移植、78保留整合版、28由当前实现替代。原C1–C4只作来源索引，不作为四次覆盖指令。17份UI运行脚本各有对应的integration替代入口，没有再建UI栈或借用旧库。

50条改动PNG路径属于298清单，与I1和当前blob一致；另11份未改动的历史`-chromium-linux`图片仍在原UI提交和工作树，61原件字节均保留。11份历史路径不计当前活动像素覆盖；当前活动`-linux`基线及R6新增图将在后续无update验收。本阶段未改产品源码、迁移、依赖锁或PNG。

补入按用例准备的未读投递、零余额账号和耗尽任务/独立申请人。真实PG先3项unknown-action失败，再8项通过，扩展后12项通过、零skip（`20261020T135228839571Z`→`20261020T135418312052Z`→`task4-checks/20261020T135807/02.log`）。保留R6图清理前拒绝、创建审计归属、存储失败重试、图删除后审计失败重试及无关账号存续，未替换为较弱UI实现。移除两项旧前提豁免；原guard的合成报告自证6项通过，验证这两项skip被拒绝、四项R6视觉豁免保留；这不是实际专项覆盖。

各次失败JSON报告和命令完整输出保留：首轮27过/1旧头像断言失败；随后30过/3旧认证观察器或平台代码断言失败；再32过/1旧等高断言失败。按真实统一登录接口、管理员TOTP挑战、真实平台字典和已批准昵称/自然卡高样张修订测试，没有退回旧产品语义。实际样张`innovation-round-1/student.css`的`align-items:start`原文提取回执为`20261020T143151183812Z`。

41项联跑`20261020T143310208101Z`为40过/1Firefox首次导航前提失败，不能写成41全绿；其中Chromium三个功能文件及三个fixture文件33项均通过。Firefox失败因乐观加载骨架也渲染侧栏按钮，旧helper误判就绪。补真实/me身份、账户链接和首页内容后，Firefox4及WebKit4全部通过、零skip/flaky（`20261020T144059560989Z`，报告SHA256与源码patch保存于`focused-browser/task4-cross-resolved-20261020T144059-357106d5/result.json`）。两引擎均由真实GET200观察到队列itemsCount=1；空态分支仍须随最终完整电池验证。该次日志存在连接重置及响应流中断，完整保留，未宣称日志零错误或据此改动传输层。

Ruff、612文件格式、mypy251、前端type/lint/CSS、独立对象存储环境、私有Git上下文、补充E2E类型和33矩阵的实际阶段记录分列于`task4-checks/`。继承的环境自测使用不存在CA路径，已改用本栈真实公钥证书的临时副本；缺失CA的产品拒绝逻辑保留，自测1项通过（`20261020T140511599601Z`）。原生Git处置审计`20261020T143710725510Z`通过。收尾8条命令均退出0（`task4-wrapup/20261020T144345/result.json`）：三项前提各三次共9项通过、零skip/flaky，最新type/lint/E2E类型/33矩阵、298处置重建、原生审计及四源保护全部通过。重复报告SHA256为`6359ae8192e236050942f75c61bbb3d548edc50d13ba81cf64773a95f7019b94`。四个源树的HEAD、index、状态及已快照文件差异均为0。本节属于I2开发回归；最终H门禁/像素/独立评审/CI仍由后续任务完成。

## Task5开发回归（尚未冻结最终H）

统一登录保留默认验证码、密码渐进展开、管理员二次验证、待审注册及独立导师入口。已用真实失败回归修复SSR事件就绪前受控输入、本地错误摘要焦点、初始账号Enter发码、最近登录长内容/完整字素及移除后焦点。重置密码与404复用批准的认证布局；后台账号批量选择保留所有字段，以语义标签适配手机记录、44px选择目标和既有列宽；审批表补齐同一标签契约，批量弹窗复用actor围栏焦点返回。没有修改后端权限、限流或操作语义。

- 管理员/新增布局24项联跑先23过1失败；实际失败为审批表标签/主字段字体及批量弹窗关闭焦点。最小修正后五宽度几何与真实Enter登录2项通过（`20261020T160317632632Z`）。随后109项联跑中管理员、教师、社群及会话围栏/轮换全部通过。
- 109项开发联跑最终为106过3失败、零skip/flaky（`20261020T160732219247Z`，完整报告在`focused-browser/task5-auth-modules-20261020T160732-c93cec03/`）。三项前提分别是旧直接退出按钮、禁用期间直接focus以及新旧用例共享邮箱触发真实60秒发码桶。改用既有R1确认退出helper、明确enabled/focused、第二教师独立邮箱，保留原断言和真实限流。
- 另以console观察器复现邀请截图在hydration前临时注入caret样式的警告（`20261020T162600280454Z`）。仅该证据截图使用`caret:initial`，并保留零hydration警告断言及完整密码/TOTP/一次性恢复码流程。
- 修正后的五个完整认证文件25/25通过、零skip/flaky（`20261020T162814075515Z`，报告SHA256 `149dbc99e6b6a95b7143efda9a5b9168ea7429c6f26ee9c0d421e22b65ea8d28`）。这不替代最终H的无过滤默认电池。
- 浏览器runner与上游CI同用既有测试登录限流profile；后端模式仍保留原默认桶，7项契约单测通过（`20261020T155500506387Z`）。专项MOCK_STORAGE及受限CAPTURE路径转发先实际RED后GREEN；宿主拒绝3种越界路径并保持默认报告，直接Linux入口3种拒绝及两项profile合计5/5通过（`20261020T160759921491Z`、`20261020T162646728919Z`）。这些入口自测不是实际专项覆盖。
- 依赖审计预检实际完成：pip无已知漏洞（`20261020T161502704929Z`）；npm门禁通过，5项开发链high仍使用既有有效豁免，复审日2027-01-07（`20261020T161452635019Z`）。不是零npm告警，最终H须重新运行。
- 更新后的逐步键盘走查16步在390/1440保留2px焦点、表单摘要、Tab顺序与输入，无横向溢出；已查看手机及桌面原尺寸截图。记录`manual-auth/20261020T163048181Z/complete.json`含2条HTTP401控制台资源消息，没有pageerror或hydration条目；当时未记录响应路径，不擅自归因。属于代理驱动真实浏览器的走查，未覆盖真人物理设备。

静态与七组无更新像素的后续记录在`task5-discovery/20261020T163440/`，完成前不写为通过。像素逐图分类见`ui-integration-pixel-walkthrough.md`；截至本节尚未更新任何PNG。此前中断world的真实只读PG审计确认其用户、run命名用户及任务均为0（`20261020T161746805770Z`）；这不代表物理对象存储的独立审计。最新四源保护检查`20261020T161030039832Z`差异均为0。

Task5后续发现与修复：审批拒绝弹窗实际Escape后丢焦点，补回归后复用现有actor围栏焦点hook；完整注册/拒绝/设备回放5项通过（`20261020T165536176420Z`）。注册fixture另经实际RED修复为world预留前缀及每用例独立后缀，真实201后的3个账号及前缀行在global teardown后均为0（`20261020T164405865490Z`）。9项旧fixture残留只存在本次新建验收库，已保存并校验私有custom pg_dump及恢复清单，再在同一锁内重建该库至ie_0042；旧开发库、原容器/卷和凭据不变（`20261020T164519567722Z`，备份SHA256 `2e283e7283dfde040680fb621fcd1157b72fbec5825e250e499e25c7a942c5da`）。

逐图核对没有直接接受旧邀请“白名单/所有员工TOTP”文案或概览的英文枚举。邀请说明已按现有注册审批及角色规则修正。概览最初的标签补丁已撤销：真实PG回归证实上游聚合漏CLOSED且列出模型不存在的COMPLETED/DEPLETED（`20261020T171257184537Z`）；再证实遗漏MENTOR及PENDING_PHONE（`20261020T173251491401Z`）。现从既有Role/UserStatus/TaskStatus生成完整零值键集，保留原聚合查询及业务时区；真实导师、待验证学生和已关闭任务都被正确计数，分类合计等于总数。完整PG模块4项通过（`20261020T173441685793Z`）。账户待审标签先实际失败为未知状态（`20261020T173301729180Z`），修复后概览复用现有共享角色/状态文案，保留权限与状态转换。当前真实后台整模块7项已通过、零skip/flaky（`20261020T173451825090Z`，报告SHA256 `bad37d5d08c47345c467462d42c67bf4cb6bb3fa3f54aef244119dbfbb557671`）。本段不把早先仅文案通过的7项当作根因修复证据。

七组首次无更新比较已全部执行：原63张活动基线中51张通过、12张主组差异；其余导航/成果审核/招募/人才/R6/导师六组均退出0、零skip/flaky。主组23项axe全过；原auth-login基线已通过。完整逐图SHA与七份报告绑定于ignored `pixels/task5-seven-groups-first.json`（`20261020T172826224131Z`）；所有PNG仍与原基线字节一致。新概览和邀请文案的最终两张图、受影响静态/全量单测正刷新，不据首次图接受旧错误数据。

覆盖核对修正：上段“七组首次比较63张、51通过”的库存绑定最初把导师两项布局当作3张正式像素。源代码调用核对发现三张stableShot仅在生命周期用例中，因此此前实际比较60张（48通过、12差异），导师3张尚未比较。原库存JSON已留副本并标注更正；完整导师文件正在以MENTOR_WORLD/VISUAL/FIXED_LABELS补跑，结果完成后再更新当前覆盖。没有将布局通过、未执行图或库存文件数当作像素成功。

完整导师首轮10项实际8过2败（`20261020T174326746019Z`，10.8分钟）；生命周期内三个正式像素均实际通过，但不能据此将整模块写成通过。失败为说明文字内链接仅靠颜色区分（axe serious），以及跨标签换号仍定位旧学号表单。局部补充链接下划线；专项测试改用现有统一账号和弱密码入口，等待可用并核对切换保留账号，原6500ms脚本延迟、真实退出/POST200及私密清理断言保留。当前整模块及受影响静态检查再次运行，未更新PNG。

导师完整修后复跑10/10通过、零skip/flaky（`20261020T175556413053Z`，9.1分钟，报告SHA256 `0cf0d3956aacc7e0dda13daa91b00ccad9085a96017f6f02e400461f26c882b4`）。实际包含生命周期内三张正式像素、真实授权/项目挂名、冲突与unknown outcome、6500ms跨标签退出换号、五宽度布局、长内容、旧记录动作及axe。修正后的七组库存`20261020T180706670474Z`因此才确认63张实际比较：51张原基线通过、12张主组有意差异。此前错误统计和首轮两失败证据保留。

后台最新两张实际图已原尺寸走查（`task5-final-canonical-admin-no-update-20261020T175531-33776796`，报告SHA256 `cc17255f8546c71232c0aacf86bd40ba82f036087263cfcc9354ca3e3ea9a94b`）：角色准确的邀请说明，四角色/五账户状态/五任务状态的真实概览；两项axe通过、两项旧PNG比较差异。作为I4候选的来源覆盖最初有缺陷的两图。四源最新保护复核`20261020T175956043232Z`全部无漂移。

I3提交前检查：前端typecheck/lint/CSS、全量907项单测、架构、18份变更E2E类型及33份矩阵全部退出0（`20261020T173543665117Z`）；最后导师链接/入口修正后，再次lint/CSS/导师E2E类型/33矩阵全部退出0（`20261020T175635691789Z`）。后端两文件格式化及全仓格式/Ruff/mypy/13架构契约、OpenAPI/types生成均退出0，两个生成文件与原生HEAD零差异（`20261020T173642489903Z`前8步）；该组合命令最终exit1仅为上述两张旧PNG比较，不是静态检查通过结论的替代。I3不含PNG、锁文件或DDL改动；I4和最终H全套门禁仍单独取得证据。
