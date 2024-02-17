// ==UserScript==
// @name         [Experimental] autoUbxEmail
// @namespace    http://tampermonkey.net/
// @description  Custom template for message templates
// @author       You
// @match        https://ubox.uhaul.net/*/*/*/calendar?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=uhaul.net
// @grant        none
// ==/UserScript==

(function () {
	'use strict';

	let clickedDate = null;
	const originalElement = $("#loading-overlay");
	const emailLoadingDiv = originalElement.clone(true);
	emailLoadingDiv.insertAfter(originalElement);
	emailLoadingDiv.attr("id", "email-loading-overlay")

	// Create SubText
	const loadingDivSubText = $(`<div style="padding-top: 10px; margin-bottom: -5px;">Loading Steps...</div>`)
	loadingDivSubText.insertAfter(emailLoadingDiv.find("h3"))
	emailLoadingDiv.hide()


	// Copy Email -- When Finished
	const emailCopyDiv = originalElement.clone(true);
	emailCopyDiv.insertAfter(originalElement);
	emailCopyDiv.attr("id", "email-finished-overlay")

	// Create SubText
	$(`<div>
		<h3>Completed</h3>
		<button>Copy Email</button>
	</div>`)
	$("#email-finished-overlay > .loading").html(`
	<div>
		<h3>Completed</h3>
		<button class="copyEmail">Copy Email</button>
	</div>`);
	emailCopyDiv.hide()

	function injectCSS(css) {
		const style = document.createElement('style');
		style.type = 'text/css';
		style.appendChild(document.createTextNode(css));
		document.head.appendChild(style);
	}

	const CSSToInject = `
		#email-finished-overlay .copyEmail {
			margin-top: 15px;
			margin-bottom: 5px;
			background: #28549E;
			border: 0px;
			border-radius: 5px;
		}

		#email-finished-overlay .copyEmail:hover {
			background: #1e3e72;
		}
	`;
	injectCSS(CSSToInject);

	function extractTextGroup(htmlContent, groupName) {
		const pattern = new RegExp(`<b>${groupName}.*?<\\/b>\\s*(.*?)\\s*(?:<text>|<b>|<br>)`, 'i');
		const match = htmlContent.match(pattern);
		return match && match[1] ? match[1].trim() : null;
	}

	function extractTimeWindowFromGroup(jquerySelector, groupNames) {
		for (let groupName of groupNames) {
			let $bTag = jquerySelector.find(`b:contains(${groupName})`);

			if ($bTag.length) {
				let nextSpan = $bTag.nextAll("span").eq(1);
				return nextSpan.text().trim();
			}
		}

		return null;
	}

	function getNumberOfBoxes(boxNumbers) {
		let result = [];

		for (let i = 0; i < boxNumbers.length; i++) {
			let boxString = boxNumbers[i];
			if (boxString.startsWith("A")) {
				result.push(boxString);
			} else {
				const boxNumMatch = boxString.match(/\((\d+)\)/);
				if (boxNumMatch) {
					const boxNum = parseInt(boxNumMatch[1]);
					for (let j = 0; j < boxNum; j++) {
						result.push("Unassigned");
					}
				} else {
					console.error(`Unexpected box string format: ${boxString}`);
				}
			}
		}

		return result;
	}

	function getNotesFromContract() {
		const GetActiveNotes = $("#contractNotesTemplateModal")
		const returnNotes = []

		if (GetActiveNotes && GetActiveNotes.css("display") == "block") {
			const NotesList = GetActiveNotes.find(".notes-list")

			if (NotesList) {
				NotesList.find("> li").each(function () {
					const NoteSpan = $(this).find("p")

					if (!NoteSpan.text().startsWith("U-Box Pickup text was sent") && !NoteSpan.text().startsWith("U-Box Home Delivery text was sent")) {
						returnNotes.push(NoteSpan.text())
					}

				})
				return returnNotes
			}
		} else {
			console.warn("UBX : No Active Notes Panel")
			return
		}
	}

	function addEmailButtons() {
		function standardizeAddress(address) {
			let standardized = address.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
			standardized = standardized.replace(/\bPort Saint Lucie\b/g, "Port St Lucie");
			standardized = standardized.replace(/ Fl /g, " FL ");
			return standardized;
		}

		function generateEmail(dayEntry) {
			let emailText = "";
			loadingDivSubText.text(`Generating Email.. Almost finished`)

			function colorText_i(text, color = "rgb(200, 38, 19)") {
				return `<i style='color: ${color}'; font-family: Arial, sans-serif'; font-size: 12pt;'>${text}</i>`
			}

			function colorText(text, color = "black") {
				return `<span style='color: ${color}'; font-family: Arial, sans-serif'; font-size: 12pt;'>${text}</span>`
			}

			function getRouteName(routeName) {
				if (routeName.startsWith("UB") || routeName.startsWith("DB")) {
					return routeName + " w/"
				} else {
					return "* Box w/" + routeName.split(" ")[0]
				}
			}

			function getEntity() {
				return $("#dynatraceEntityAndUserName").text().substring(0, 6).trim() || 781000
			}

			function formatCoveringEntity(covering, deliveryType) {
				covering = $($('<div>').html(covering)).text();

				if (Number(covering) !== Number(getEntity())) {
					const actionWord = deliveryType === "Deliver" ? "Pickup" : "Return";
					return " (" + actionWord + " @ " + covering + ")"
				}

				return ""
			}

			emailText += "<b style='color: black; font-size: 16pt;'>" + getEntity() + "</b><br>";

			for (let route of dayEntry.routes) {
				if (route.routeStart !== "(Unassigned)") {
					emailText += "<b style='color: black; font-size: 14pt;'>" + getRouteName(route.routeStart) + "</b><br>";

					for (let movement of route.groupMovements) {
						if (movement.deliveryType.toLowerCase() === "transfer") {
							emailText += "<b>" + colorText_i("TRANSFER") + colorText(" " + movement.transfer_Amount + " from ") + colorText_i(movement.transfer_From) + " to " + colorText_i(movement.transfer_To) + "<b><br>"
						} else {
							const actionWord = movement.deliveryType === "Deliver" ? "to" : "from";
							emailText += "<b>" + colorText_i(movement.deliveryType.toUpperCase()) + " " + colorText(getNumberOfBoxes(movement.boxNumbers).length) + " " + colorText(movement.delivery_Box) + " " + colorText(actionWord) + " " + colorText_i(movement.delivery_LastName) + colorText(" in ") + colorText_i(standardizeAddress(movement.delivery_City).toUpperCase()) + colorText(" between ") + colorText_i(movement.delivery_Window) + colorText(formatCoveringEntity(movement.delivery_CoveringEntity, movement.deliveryType)) + "</b><br>"
							emailText += `<b> ${colorText("Phone: ")} </b>` +  colorText(movement.delivery_PhoneNumber) + "<br>"
							emailText += `<b> ${colorText("Address: ")} </b>` + colorText(standardizeAddress(movement.delivery_Address)) + "<br>"
						}

						if (movement.delivery_Notes && movement.delivery_Notes.length) {
							emailText += `<b>${colorText("Notes:")}</b>`
							emailText += "<ul style='color: black; font-size: 12pt;'>";
							for (let note of movement.delivery_Notes) {
								emailText += "<li>" + colorText(note) + "</li>";
							}
							emailText += "</ul>";
							//emailText += "<br>"
						}

						if (movement.boxNumbers && movement.boxNumbers.length) {
							emailText += `<b>${colorText("Boxes:")}</b>`
							emailText += "<ul style='color: black; font-size: 12pt;'>";
							for (let box of getNumberOfBoxes(movement.boxNumbers)) {
								emailText += "<li>" + colorText(box) + "</li>";
							}
							emailText += "</ul>";
						}

						emailText += "<br>";
					}
					emailText += "<br><br>";
				}
			}

			emailText += "";
			emailLoadingDiv.fadeOut()
			$("#selectMCOOverlay").hide()
			emailCopyDiv.show()
			$("#contractNotesTemplateModal").find(".close-reveal-modal").click()
			$("#selectMCOOverlay").hide()
			return emailText;
		}

		function delay(ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		}

		const calendarDays = document.querySelectorAll('.calendar-days > .calendar-day');

		async function getCalenderData() {
			let All = { days: [] };
			emailLoadingDiv.fadeIn();

			for (let dayElement of calendarDays) {
				const Day = dayElement.querySelector(".stop_row");
				const date = Day.getAttribute('data-date');

				let dayEntry = { date: date, routes: [] };
				let currentRoute = null;

				const routeDivs = dayElement.querySelectorAll('.dynamic-routes > div');
				for (let routeDiv of routeDivs) {
					if (routeDiv.classList.contains('route-start')) {
						if (currentRoute) {
							dayEntry.routes.push(currentRoute);
						}
						currentRoute = {
							routeStart: routeDiv.querySelector(".route-name").textContent,
							groupMovements: []
						};
					} else if (routeDiv.classList.contains('group-movements') && currentRoute) {
						const calendarUboxes = routeDiv.querySelectorAll('.calendar-ubox');
						for (let uboxElement of calendarUboxes) {
							const DeliveryID = uboxElement.querySelector(".ubox").getAttribute("data-module");
							const DeliveryToolTip = $(DeliveryID);

							if (DeliveryToolTip.length) {
								const DelTypeH1 = DeliveryToolTip.find("> h1").text().trim();
								let inf_DelType;
								let boxNumStorage = [];

								let transfer_Amount
								let transfer_From
								let transfer_To

								let delivery_LastName
								let delivery_PhoneNumber
								let delivery_Address
								let delivery_City
								let delivery_Window
								let delivery_CoveringEntity
								let delivery_Box
								let delivery_Notes

								if (DelTypeH1.toLowerCase() === "scheduled transfer" || DelTypeH1.toLowerCase() === "hub transfer") {
									loadingDivSubText.text(`Adding Transfer to datalist`)
									inf_DelType = "Transfer";

									const TransferString = DeliveryToolTip.find("p").text().trim().split(" ")
									transfer_Amount = TransferString[2]
									transfer_From = TransferString[4]
									transfer_To = TransferString[6]

									const BoxNumbers = DeliveryToolTip.find(".no-styles li");
									BoxNumbers.each(function () {
										loadingDivSubText.text(`Adding Box Number to transfer list`)
										boxNumStorage.push($(this).text());
									});
								} else {
									inf_DelType = DeliveryToolTip.find("> p > span").text().trim().split(" ")[0];
									delivery_Box = DeliveryToolTip.find("> p > span").text().trim().split(" ")[3].toUpperCase();

									const CustomerName = DeliveryToolTip.find(".no-styles > span:first").text().trim().split(" ");
									delivery_LastName = CustomerName.slice(1).join(" ").toUpperCase();

									loadingDivSubText.text(`Adding ${delivery_LastName} to datalist`)

									const CustomerAddress = DeliveryToolTip.find(".no-styles > span:eq(1)").text().trim();
									const CustomerAddressCityState = DeliveryToolTip.find(".no-styles > span:eq(2)").text().trim();
									delivery_Address = CustomerAddress + ", " + CustomerAddressCityState
									delivery_City = CustomerAddressCityState.split(",")[0].toUpperCase()

									const CustomerPhoneNumber = DeliveryToolTip.find("a > span:first").text().trim()
									delivery_PhoneNumber = CustomerPhoneNumber

									if (DeliveryToolTip.find(".no-styles > span:eq(3)")) {
										const TimeWindow = extractTimeWindowFromGroup(DeliveryToolTip.find(".no-styles"), ["Pickup Window:", "Delivery Window:"]);
										if (TimeWindow) {
											delivery_Window = TimeWindow
										} else {
											delivery_Window = "Unscheduled"
										}

										const CoveringEntity = extractTextGroup(DeliveryToolTip.find(".no-styles").html(), ["Covering Entity:"], 2);
										if (CoveringEntity) {
											delivery_CoveringEntity = CoveringEntity
										} else {
											delivery_CoveringEntity = 781008
										}
									}

									const BoxNumbers = DeliveryToolTip.find(".no-styles li");
									BoxNumbers.each(function () {
										loadingDivSubText.text(`Adding Box Number to ${delivery_LastName} ${inf_DelType}`)
										boxNumStorage.push($(this).text());
									});

									$("#contractNotesTemplateModal").css("position", "relative")

									if (clickedDate && clickedDate === date) {
										const NotesButton = DeliveryToolTip.find('a[data-bind*="ShowContractNotes"]');
										if (NotesButton) {
											$("#selectMCOOverlay").hide()
											NotesButton.on('click', function(event) {
												event.stopPropagation();
											});
											
											NotesButton.click();
											await delay(500);
											
											const NotesForContract = getNotesFromContract()
											if (NotesForContract) {
												delivery_Notes = NotesForContract
												loadingDivSubText.text(`Fetching ${delivery_LastName}'s Notes`)
											} else {
												loadingDivSubText.text(`No recent notes found for ${delivery_LastName}`)
											}

											$("#selectMCOOverlay").hide()
											await delay(2000);
										}
									}
									$("#contractNotesTemplateModal").css("position", "")
								}

								currentRoute.groupMovements.push({
									deliveryType: inf_DelType,
									deliveryID: DeliveryID,
									tooltip: DeliveryToolTip,
									boxNumbers: boxNumStorage,
									transfer_Amount: transfer_Amount,
									transfer_From: transfer_From,
									transfer_To: transfer_To,
									delivery_LastName: delivery_LastName,
									delivery_PhoneNumber: delivery_PhoneNumber,
									delivery_Address: delivery_Address,
									delivery_City: delivery_City,
									delivery_Window: delivery_Window,
									delivery_CoveringEntity: delivery_CoveringEntity,
									delivery_Box: delivery_Box,
									delivery_Notes: delivery_Notes,
								});
							}
						};
					}
				};

				if (currentRoute) {
					dayEntry.routes.push(currentRoute);
				}

				All.days.push(dayEntry);
			};

			return All
		}

		const CalenderListDays = $(".calendar-days");
		CalenderListDays.find("> .calendar-day").each(function (index) {
			const NotesTab = $(this).find(".notes");
			let emailButton = $(this).find("#email");

			if (emailButton.length === 0) {
				emailButton = NotesTab.clone().attr('id', 'email');
				NotesTab.after(emailButton);
			}

			emailButton.find('.fa-file-text-o').remove();
			emailButton.find('span').text("Email").off('click').click(async function (event) {
				event.preventDefault();

				clickedDate = $(this).closest(".calendar-day").find(".stop_row").data('date');

				const emailData = await getCalenderData()
				const dayEntry = emailData.days[index];
				const emailText = generateEmail(dayEntry);

				$(".copyEmail").off('click').click(function () {
					emailCopyDiv.fadeOut()
					navigator.clipboard.write([
						new ClipboardItem({
							'text/html': new Blob([emailText], { type: 'text/html' })
						})
					]);
				})

				$(this).text("Copied!");
				setTimeout(() => {
					$(this).text("Email");
				}, 700);
			});
		});
	}

	function runEmailButtons() {
		setInterval(() => {
			addEmailButtons()
		}, 2000);
	}

	runEmailButtons();
})();
