// ==UserScript==
// @name         [Experimental] autoUbxEmail
// @namespace    http://tampermonkey.net/
// @description  Custom template for message templates
// @author       You
// @match        https://ubox.uhaul.net/*/*/*/calendar?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=uhaul.net
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	// 1. Add a global variable to store the clicked date
	let clickedDate = null;

    function extractTextGroup(htmlContent, groupName) {
        // Create a regex pattern to capture the text after the group name until the next <text>, <b> or <br> tag.
        const pattern = new RegExp(`<b>${groupName}.*?<\\/b>\\s*(.*?)\\s*(?:<text>|<b>|<br>)`, 'i');
        const match = htmlContent.match(pattern);
        return match && match[1] ? match[1].trim() : null;
    }

	function extractTimeWindowFromGroup(jquerySelector, groupNames) {
		for (let groupName of groupNames) {
			let $bTag = jquerySelector.find(`b:contains(${groupName})`);

			if ($bTag.length) {
				let nextSpan = $bTag.nextAll("span").eq(1); // eq(1) gets the second span
				return nextSpan.text().trim();
			}
		}

		return null;
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
				return $("optgroup").find("> option:selected").text().trim().split(" ")[0] || 781000
			}

			function formatCoveringEntity(covering, deliveryType) {
                covering = $($('<div>').html(covering)).text();

				if (Number(covering) !== Number(getEntity())) {
                    const actionWord = deliveryType === "Deliver" ? "Pickup" : "Return";
                    console.log(getEntity())
					console.log(covering)
                    console.log(covering == getEntity())
					console.log(deliveryType)
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
							emailText += "<b><i style='color: rgb(200, 38, 19); font-size: 12pt;'>TRANSFER</i> " + movement.transfer_Amount + " from " + `<i style='color: rgb(200, 38, 19); font-size: 12pt;'>${movement.transfer_From}</i>` + " to " + `<i style='color: rgb(200, 38, 19); font-size: 12pt;'>${movement.transfer_To}</i></b>` + "<br>";
						} else {
							const actionWord = movement.deliveryType === "Deliver" ? "to" : "from";
							emailText += "<b>" + colorText_i(movement.deliveryType.toUpperCase()) + " " + colorText(movement.boxNumbers.length) + " " + colorText(movement.delivery_Box) + " " + colorText(actionWord) + " " + colorText_i(movement.delivery_LastName) + colorText(" in ") + colorText_i(standardizeAddress(movement.delivery_City).toUpperCase()) + colorText(" between ") + colorText_i(movement.delivery_Window) + colorText(formatCoveringEntity(movement.delivery_CoveringEntity, movement.deliveryType)) + "</b><br>"
							emailText += colorText(movement.delivery_PhoneNumber + "&nbsp;&nbsp;&nbsp;&nbsp;" + standardizeAddress(movement.delivery_Address)) + "<br>"
						}

						//emailText += colorText("notes: ", "light gray") + "<br>"

						if (movement.boxNumbers && movement.boxNumbers.length) {
							emailText += "<ul style='color: black; font-size: 12pt;'>";
							for (let box of movement.boxNumbers) {
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
			return emailText;
		}

		function delay(ms) {
			return new Promise(resolve => setTimeout(resolve, ms));
		}

		const CalenderList = $(".calendar-days");
		function getCalenderData() {
			let All = { days: [] };

			$("#selectMCOOverlay").fadeIn();
			CalenderList.find("> .calendar-day").each(function(index) {
				const Day = $(this).find(".stop_row");
				const date = Day.data('date');
				const RouteDivs = $(this).find(".dynamic-routes > div");

				let dayEntry = { date: date, routes: [] };
				let currentRoute = null;

				RouteDivs.each(function() {
					if ($(this).hasClass('route-start')) {
						if (currentRoute) {
							dayEntry.routes.push(currentRoute);
						}
						currentRoute = {
							routeStart: $(this).find(".route-name").text(),
							groupMovements: []
						};
					} else if ($(this).hasClass('group-movements') && currentRoute) {
						$(this).find(".calendar-ubox").each(async function() {
							const DeliveryID = $(this).find("> .ubox").data("module");
							const DeliveryToolTip = $(DeliveryID);

							if (DeliveryToolTip.length) {
								const DelTypeH1 = DeliveryToolTip.find("> h1").text().trim();
								let inf_DelType;
								let boxNumStorage = [];

								// transfer segment
								let transfer_Amount
								let transfer_From
								let transfer_To

								// delivery/pickup segment
								let delivery_LastName
								let delivery_PhoneNumber
								let delivery_Address
								let delivery_City
								let delivery_Window
								let delivery_CoveringEntity
								let delivery_Box
								let delivery_Notes

								if (DelTypeH1.toLowerCase() === "scheduled transfer" || DelTypeH1.toLowerCase() === "hub transfer") {
									inf_DelType = "Transfer";

									const TransferString = DeliveryToolTip.find("p").text().trim().split(" ")
									transfer_Amount = TransferString[2]
									transfer_From = TransferString[4]
									transfer_To = TransferString[6]

									const BoxNumbers = DeliveryToolTip.find(".no-styles li");
									BoxNumbers.each(function() {
										boxNumStorage.push($(this).text());
									});
								} else {
									inf_DelType = DeliveryToolTip.find("> p > span").text().trim().split(" ")[0];
									delivery_Box = DeliveryToolTip.find("> p > span").text().trim().split(" ")[3].toUpperCase();

									const CustomerName = DeliveryToolTip.find(".no-styles > span:first").text().trim().split(" ");
									delivery_LastName = CustomerName.slice(1).join(" ").toUpperCase();

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
                                            console.log(CoveringEntity)
											delivery_CoveringEntity = CoveringEntity
										} else {
											delivery_CoveringEntity = 781008
										}
									}

									const BoxNumbers = DeliveryToolTip.find(".no-styles li");
									BoxNumbers.each(function() {
										boxNumStorage.push($(this).text());
									});

									$("#contractNotesTemplateModal").css("position", "relative")

									if(clickedDate && clickedDate === date) {
										const NotesButton = DeliveryToolTip.find('a[data-bind*="ShowContractNotes"]');
										if (NotesButton) {
											//await delay(3000);  // Wait for 3 seconds
											console.log("Fetch Notes")
											//NotesButton.click();
											delivery_Notes = "Hello"
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
						});
					}
				});

				if (currentRoute) {
					dayEntry.routes.push(currentRoute);
				}

				All.days.push(dayEntry);
			});
			$("#contractNotesTemplateModal").find(".close-reveal-modal").click()
			$("#selectMCOOverlay").fadeOut()
			return All
		}

		CalenderList.find("> .calendar-day").each(function(index) {
			const NotesTab = $(this).find(".notes");
			let emailButton = $(this).find("#email");

			if(emailButton.length === 0) {
				emailButton = NotesTab.clone().attr('id', 'email');
				NotesTab.after(emailButton);
			}

			emailButton.find('.fa-file-text-o').remove();
			emailButton.find('span').text("Email").off('click').click(function(event) {
				event.preventDefault();

				clickedDate = $(this).closest(".calendar-day").find(".stop_row").data('date');

				const emailData = getCalenderData()
				const dayEntry = emailData.days[index];
				const emailText = generateEmail(dayEntry);

				navigator.clipboard.write([
					new ClipboardItem({
						'text/html': new Blob([emailText], { type: 'text/html' })
					})
				]);

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
